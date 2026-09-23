// Live demo on a public TESTNET (§17 Phase 4 ✅): issue → Oracle (in-process, real HTTP) → Merchant → redeem.
//   pnpm --filter @flying-money/agent demo:testnet [--chain arbitrum-sepolia] [--face 0.50] [--certificate 0x…]
// Keys from .env only (never printed): DEMO_FUNDER_KEY, DEMO_AGENT_KEY, REDEEMER_KEY, PAYEE_ADDRESS.
import { existsSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import { join } from 'node:path'
import { flyingMoneyAbi } from '@flying-money/abi'
import { type ChainKey, getChain, isChainKey, rpcUrl } from '@flying-money/chains'
import { createFlyingMoneyClient, fileStore } from '@flying-money/client'
import { type Hex, readCertificate } from '@flying-money/core'
import { createOracle, type OracleEvent } from '@flying-money/oracle'
import { memoryStore } from '@flying-money/server'
import { serve } from '@hono/node-server'
import { createPublicClient, createWalletClient, erc20Abi, formatUnits, http, parseUnits, type PublicClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { runMerchant } from './merchant.js'

const root = join(import.meta.dirname, '..', '..', '..')
if (existsSync(join(root, '.env'))) process.loadEnvFile(join(root, '.env'))
const argv = process.argv.slice(2)
const arg = (n: string) => {
  const i = argv.indexOf(n)
  return i >= 0 ? argv[i + 1] : undefined
}
const chainKey = arg('--chain') ?? 'arbitrum-sepolia'
if (!isChainKey(chainKey)) throw new Error(`unknown chain ${chainKey}`)
const chain = getChain(chainKey)
if (chain.mainnet) throw new Error('demo:testnet refuses mainnets (§0.1: mainnet transactions need explicit approval)')
if (!chain.flyingMoney) throw new Error(`no FlyingMoney deployment recorded for ${chainKey}`)
const fmAddr = chain.flyingMoney
const face = parseUnits(arg('--face') ?? '0.50', 6)

const key = (name: string) => {
  const raw = process.env[name]?.trim()
  if (!raw) throw new Error(`${name} is not set in .env`)
  return privateKeyToAccount((raw.startsWith('0x') ? raw : `0x${raw}`) as Hex)
}
const funder = key('DEMO_FUNDER_KEY')
const agent = key('DEMO_AGENT_KEY')
const redeemer = key('REDEEMER_KEY')
const payee = process.env.PAYEE_ADDRESS as Hex
if (!/^0x[0-9a-fA-F]{40}$/.test(payee ?? '')) throw new Error('PAYEE_ADDRESS is not set')

const env = process.env
const transport = http(rpcUrl(chainKey, env))
const pub = createPublicClient({ chain: chain.chain, transport, pollingInterval: 500 }) as PublicClient
const tx = (h: Hex) => `${chain.explorer}/tx/${h}`
const usdcBal = (a: Hex) => pub.readContract({ address: chain.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [a] })
const log = (s: string) => console.log(s)

log(`chain ${chainKey} · FlyingMoney ${fmAddr} · USDC ${chain.usdc} (testnet: test money only)`)
log(`funder ${funder.address} · agent ${agent.address} · payee ${payee} · redeemer ${redeemer.address}`)
const payeeBefore = await usdcBal(payee)

// 1. Funder issues a certificate (or reuse one with --certificate).
let id = arg('--certificate') as Hex | undefined
if (!id) {
  const fw = createWalletClient({ account: funder, chain: chain.chain, transport })
  const allowance = await pub.readContract({
    address: chain.usdc,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [funder.address, fmAddr],
  })
  if (allowance < face) {
    const h = await fw.writeContract({ address: chain.usdc, abi: erc20Abi, functionName: 'approve', args: [fmAddr, face] })
    await pub.waitForTransactionReceipt({ hash: h })
    log(`approve ${formatUnits(face, 6)} USDC: ${tx(h)}`)
  }
  const { timestamp } = await pub.getBlock()
  const args = [payee, agent.address, face, timestamp + 7n * 86_400n] as const // ≥ 1 day lifetime (D10)
  const { result, request } = await pub.simulateContract({
    account: funder,
    address: fmAddr,
    abi: flyingMoneyAbi,
    functionName: 'issue',
    args,
  })
  const h = await fw.writeContract(request)
  const r = await pub.waitForTransactionReceipt({ hash: h })
  if (r.status !== 'success') throw new Error(`issue reverted: ${tx(h)}`)
  id = result
  log(`issued certificate ${id} · ${formatUnits(face, 6)} USDC · 7 days: ${tx(h)}`)
}

// 2. The Oracle, in-process over real HTTP, with its redeemer (demo policy: 0.10 USDC or 60 s).
const oracle = createOracle({
  accepts: [chainKey as ChainKey],
  payee,
  store: memoryStore(),
  env,
  redeemer: { account: redeemer, pollingIntervalMs: 500 },
})
const redemptions: Array<{ txHash: Hex; paid: bigint }> = []
oracle.events.on('redeemed', (e: Extract<OracleEvent, { type: 'redeemed' }>) => {
  redemptions.push({ txHash: e.txHash, paid: BigInt(e.paid) })
  log(`REDEEMED on-chain ${formatUnits(BigInt(e.paid), 6)} USDC (cumulative ${formatUnits(BigInt(e.cumulative), 6)}): ${tx(e.txHash)}`)
})
oracle.events.on('error', (e) => log(`redeemer alert: ${JSON.stringify(e)}`))
const server = serve({ fetch: oracle.app.fetch, port: 0 })
await new Promise<void>((r) => (server.listening ? r() : server.once('listening', () => r())))
const oracleUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
log(`Silk Road Oracle on ${oracleUrl}`)

// 3. The Merchant with a durable outbox.
const fm = createFlyingMoneyClient({
  chains: [chainKey as ChainKey],
  spender: agent,
  store: fileStore(join(root, `.flying-money.${chainKey}.json`)),
  certificates: [id],
  maxPricePerRequest: 50_000n,
  env,
  onEvent: (e) => {
    if (e.type === 'sealed') log(`  402 → sealed note, cumulative ${formatUnits(e.cumulative, 6)}`)
  },
})
await fm.ready
if (fm.status().length === 0) throw new Error('agent cannot see the certificate (wrong spender or chain?)')
const merchant = await runMerchant({
  fm,
  oracleUrl,
  log: async (line) => {
    log(line)
    await oracle.redeemer?.tick()
  },
})
await oracle.redeemer?.tick({ force: true }) // "Redeem now"
server.close()

// 4. Summary, read back from the chain.
const c = (await readCertificate(pub, fmAddr, id))!
const payeeGain = (await usdcBal(payee)) - payeeBefore
const txs = new Set(redemptions.map((r) => r.txHash))
log('')
log(`calls ${merchant.calls} · served ${merchant.served} · failed ${merchant.failed}`)
log(`consumed ${formatUnits(fm.status()[0]?.consumed ?? 0n, 6)} USDC · redeemed on-chain ${formatUnits(c.redeemed, 6)} USDC in ${txs.size} tx`)
log(`payee received ${formatUnits(payeeGain, 6)} USDC · remaining ${formatUnits(c.faceValue - c.redeemed, 6)} returns to the funder after expiry`)
log(`certificate: ${chain.explorer}/address/${fmAddr} · id ${id}`)
if (merchant.bestTrade) log(`best trade: ${JSON.stringify(merchant.bestTrade)}`)
process.exit(merchant.served >= 20 && txs.size >= 1 && payeeGain === c.redeemed ? 0 : 1)
