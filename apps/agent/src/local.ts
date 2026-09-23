// End-to-end local run (anvil): deploy → issue a 0.50 USDC certificate → Oracle over real HTTP → Merchant → redeem.
import type { AddressInfo } from 'node:net'
import { flyingMoneyAbi, mockUsdcAbi } from '@flying-money/abi'
import { setLocalDeployment } from '@flying-money/chains'
import { createFlyingMoneyClient, memoryStore } from '@flying-money/client'
import { type Hex, readCertificate } from '@flying-money/core'
import { createOracle, type OracleEvent } from '@flying-money/oracle'
import { memoryStore as sellerMemoryStore } from '@flying-money/server'
import { serve } from '@hono/node-server'
import { createWalletClient, http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { anvil as anvilChain } from 'viem/chains'
import { anvilAccount, deployLocal, startAnvil } from './anvil.js'
import { type MerchantResult, runMerchant } from './merchant.js'

export interface LocalDemoResult {
  merchant: MerchantResult
  certificateId: Hex
  faceValue: bigint
  served: bigint
  redemptions: Array<{ txHash: Hex; paid: bigint; cumulative: bigint }>
  payeeReceived: bigint
  onchainRedeemed: bigint
}

export async function runLocalDemo(opts: { log?: (line: string) => void; offlineWeather?: boolean } = {}) {
  const log = opts.log ?? console.log
  const anvil = await startAnvil()
  const stops: Array<() => void> = [anvil.stop]
  try {
    const env = { RPC_ANVIL: anvil.url }
    const { pub, usdc, flyingMoney, wait } = await deployLocal(anvil.url)
    setLocalDeployment({ usdc, flyingMoney })
    log(`anvil ${anvil.url} · MockUSDC ${usdc} (test money) · FlyingMoney ${flyingMoney}`)

    const funder = anvilAccount(1)
    const payee = anvilAccount(2)
    const redeemer = anvilAccount(3)
    const agent = privateKeyToAccount(generatePrivateKey()) // generated where it runs; never printed

    // Funder: faucet → approve → issue 0.50 USDC for the Oracle, usable by the agent key, 7 days.
    const fw = createWalletClient({ account: funder, chain: anvilChain, transport: http(anvil.url) })
    await wait(await fw.writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'faucet' }))
    await wait(
      await fw.writeContract({
        address: usdc,
        abi: mockUsdcAbi,
        functionName: 'approve',
        args: [flyingMoney, 500_000n],
      }),
    )
    const { timestamp } = await pub.getBlock()
    const args = [payee.address, agent.address, 500_000n, timestamp + 7n * 86_400n] as const
    const { result: id } = await pub.simulateContract({
      account: funder,
      address: flyingMoney,
      abi: flyingMoneyAbi,
      functionName: 'issue',
      args,
    })
    await wait(await fw.writeContract({ address: flyingMoney, abi: flyingMoneyAbi, functionName: 'issue', args }))
    log(`certificate ${id}: 0.50 USDC for Silk Road Oracle, agent ${agent.address}, 7 days`)

    // Seller: the Oracle over real HTTP, with its redeemer (demo policy: 0.10 USDC or 60 s).
    const oracle = createOracle({
      accepts: ['anvil'],
      payee: payee.address,
      store: sellerMemoryStore(),
      env,
      redeemer: { account: redeemer, pollingIntervalMs: 50 },
      ...(opts.offlineWeather
        ? { fetchWeather: async () => ({ temperature_c: 20, wind_kmh: 5, time: new Date().toISOString() }) }
        : {}),
    })
    const redemptions: LocalDemoResult['redemptions'] = []
    oracle.events.on('redeemed', (e: Extract<OracleEvent, { type: 'redeemed' }>) => {
      redemptions.push({ txHash: e.txHash, paid: BigInt(e.paid), cumulative: BigInt(e.cumulative) })
      log(`redeemed on-chain: ${e.paid} (cumulative ${e.cumulative}) tx ${e.txHash}`)
    })
    const server = serve({ fetch: oracle.app.fetch, port: 0 })
    stops.push(() => server.close())
    await new Promise<void>((r) => (server.listening ? r() : server.once('listening', () => r())))
    const oracleUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    log(`Silk Road Oracle listening on ${oracleUrl}`)

    // Buyer: the Merchant with its certificate.
    const fm = createFlyingMoneyClient({
      chains: ['anvil'],
      spender: agent,
      store: memoryStore(),
      certificates: [id],
      maxPricePerRequest: 50_000n,
      env,
      onEvent: (e) => {
        if (e.type === 'sealed') log(`  402 → sealed note, cumulative ${e.cumulative}`)
      },
    })
    const merchant = await runMerchant({
      fm,
      oracleUrl,
      log: async (line) => {
        log(line)
        await oracle.redeemer?.tick() // the redeemer loop, driven per call so redemptions show up during the run
      },
    })
    await oracle.redeemer?.tick({ force: true }) // "Redeem now"

    const c = (await readCertificate(pub, flyingMoney, id))!
    const payeeReceived = await pub.readContract({
      address: usdc,
      abi: mockUsdcAbi,
      functionName: 'balanceOf',
      args: [payee.address],
    })
    const served = fm.status()[0]?.consumed ?? 0n
    log(
      `done: ${merchant.served} served / ${merchant.calls} calls · consumed ${served} · redeemed ${c.redeemed} in ${new Set(redemptions.map((r) => r.txHash)).size} tx · remaining ${c.faceValue - c.redeemed} returns to the funder after expiry`,
    )
    return {
      merchant,
      certificateId: id,
      faceValue: c.faceValue,
      served,
      redemptions,
      payeeReceived,
      onchainRedeemed: c.redeemed,
    } satisfies LocalDemoResult
  } finally {
    for (const s of stops.reverse()) s()
  }
}
