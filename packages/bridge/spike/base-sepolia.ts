// Spike: an agent pays an ordinary x402 endpoint (one that has never heard of Flying Money) from a Flying Money budget,
// through a self-hosted bridge. Everything is real on Base Sepolia: the budget, the bridge's payment, the facilitator.
//
//   pnpm --filter @flying-money/bridge spike         (reads DEMO_FUNDER_KEY from the repo .env; costs about 0.1 test USDC)
//
// Keys are generated per run and never printed. The funder pays the float and the budget out of its own test USDC.
import { existsSync, readFileSync } from 'node:fs'
import type { AddressInfo } from 'node:net'
import path from 'node:path'
import { flyingMoneyAbi } from '@flying-money/abi'
import { getChain } from '@flying-money/chains'
import { createFlyingMoneyClient, memoryStore } from '@flying-money/client'
import { createRedeemer, memoryStore as sellerMemoryStore } from '@flying-money/server'
import { serve } from '@hono/node-server'
import { HTTPFacilitatorClient } from '@x402/core/server'
import { ExactEvmScheme } from '@x402/evm/exact/server'
import { paymentMiddleware, x402ResourceServer } from '@x402/hono'
import { Hono } from 'hono'
import { createPublicClient, createWalletClient, erc20Abi, type Hex, http } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { createBridge, viaBridge } from '../src/index.js'

function envKey(name: string): Hex {
  if (process.env[name]) return process.env[name] as Hex
  const f = path.resolve('../../.env')
  const m = existsSync(f)
    ? readFileSync(f, 'utf8').match(new RegExp(`^\\s*${name}\\s*=\\s*"?([^"\\r\\n]+)"?`, 'm'))
    : null
  if (!m) throw new Error(`${name} missing from the environment and the repo .env`)
  return (m[1] as string).trim() as Hex
}
const listen = async (app: { fetch: (...a: never[]) => unknown }) => {
  const s = serve({ fetch: app.fetch as never, port: 0, hostname: '127.0.0.1' })
  await new Promise<void>((r) => (s.listening ? r() : s.once('listening', () => r())))
  return { server: s, url: `http://127.0.0.1:${(s.address() as AddressInfo).port}` }
}

const FACILITATOR = process.env.X402_FACILITATOR ?? 'https://x402.org/facilitator'
const chain = getChain('base-sepolia')
const NETWORK = `eip155:${chain.chain.id}` as const
const pub = createPublicClient({ chain: chain.chain, transport: http() })
const owner = privateKeyToAccount(envKey('DEMO_FUNDER_KEY'))
const ownerWallet = createWalletClient({ account: owner, chain: chain.chain, transport: http() })
const float = privateKeyToAccount(generatePrivateKey()) // the bridge's wallet: pays upstream, receives collections
const agent = privateKeyToAccount(generatePrivateKey()) // the agent's spending key: holds no money
const stranger = privateKeyToAccount(generatePrivateKey()) // the x402 endpoint's own payTo address
const usdc = (a: Hex) => pub.readContract({ address: chain.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [a] })
const fmt = (n: bigint) => `${(Number(n) / 1e6).toFixed(6)} USDC`
const wait = (hash: Hex) => pub.waitForTransactionReceipt({ hash })
const step = (s: string) => console.log(`\n== ${s}`)

// 1. A stranger's x402 endpoint: plain @x402/hono, no Flying Money anywhere.
step('1. an ordinary x402 endpoint (knows nothing about Flying Money)')
const resourceServer = new x402ResourceServer(new HTTPFacilitatorClient({ url: FACILITATOR })).register(
  NETWORK,
  new ExactEvmScheme(),
)
const strangerApp = new Hono()
strangerApp.use(
  paymentMiddleware(
    {
      'GET /premium': {
        accepts: { scheme: 'exact', price: '$0.001', network: NETWORK, payTo: stranger.address },
        description: 'A premium fact',
      },
    },
    resourceServer,
  ),
)
strangerApp.get('/premium', (c) => c.json({ fact: 'The Tang merchants invented the certificate in 804.' }))
const upstream = await listen(strangerApp)
console.log('endpoint', `${upstream.url}/premium`, 'pays', stranger.address)

// 2. The owner funds the bridge's float and issues a budget whose payee is the bridge, spender the agent.
step('2. the owner funds the float and issues a budget to the bridge')
const FLOAT = 20_000n // 0.02 USDC of working capital
const FACE = 50_000n // the agent's whole budget: 0.05 USDC
const t1 = await ownerWallet.writeContract({
  address: chain.usdc,
  abi: erc20Abi,
  functionName: 'transfer',
  args: [float.address, FLOAT],
})
await wait(t1)
const t2 = await ownerWallet.writeContract({
  address: chain.usdc,
  abi: erc20Abi,
  functionName: 'approve',
  args: [chain.flyingMoney as Hex, FACE],
})
await wait(t2)
await new Promise((r) => setTimeout(r, 2500)) // let the RPC node catch up with the approval
const { timestamp } = await pub.getBlock()
const { result: certificateId, request } = await pub.simulateContract({
  account: owner,
  address: chain.flyingMoney as Hex,
  abi: flyingMoneyAbi,
  functionName: 'issue',
  args: [float.address, agent.address, FACE, timestamp + 2n * 86_400n],
})
const issueTx = await ownerWallet.writeContract(request)
await wait(issueTx)
await new Promise((r) => setTimeout(r, 3000))
console.log('budget', certificateId, 'face', fmt(FACE), 'payee = bridge', float.address)

// 3. The bridge (self-hosted): a Flying Money seller whose product is "an x402 call".
step('3. the bridge')
const sellerStore = sellerMemoryStore()
const bridge = createBridge({
  accepts: ['base-sepolia'],
  float,
  store: sellerStore,
  upstreamNetworks: [NETWORK],
  maxUpstreamAmount: 50_000n,
  feeBps: 0,
  target: { allowLocal: true }, // the demo endpoint is on localhost; a deployed bridge never sets this
})
const bridgeSrv = await listen(bridge.app)
console.log('bridge', bridgeSrv.url)

// 4. The agent: an ordinary Flying Money client. One call, to a URL it never negotiated with.
step('4. the agent pays the stranger through the bridge')
const fm = createFlyingMoneyClient({
  chains: ['base-sepolia'],
  spender: agent,
  store: memoryStore(),
  certificates: [certificateId],
  maxPricePerRequest: 20_000n,
  onEvent: (e) => {
    if (e.type === 'offer') console.log('  bridge quoted', fmt(e.offer.price))
    if (e.type === 'sealed') console.log('  agent signed a note, cumulative', fmt(e.cumulative))
  },
})
await fm.ready
const before = { float: await usdc(float.address), stranger: await usdc(stranger.address) }
const target = `${upstream.url}/premium`
const res = await fm.fetch(viaBridge(bridgeSrv.url, target))
console.log('  status', res.status, 'body', await res.text())
const settle = res.headers.get('x-upstream-payment-response')
if (settle)
  console.log('  upstream settlement', JSON.parse(Buffer.from(settle, 'base64').toString()).transaction ?? settle)
const after = { float: await usdc(float.address), stranger: await usdc(stranger.address) }
console.log('  stranger received', fmt(after.stranger - before.stranger))
console.log('  bridge float', fmt(before.float), '->', fmt(after.float))
console.log(
  '  budget status',
  fm.status().map((s) => ({ consumed: fmt(s.consumed), remaining: fmt(s.remaining) })),
)

// 5. A second call, then a replay of the first note: the bridge must not pay the stranger twice.
step('5. a second paid call')
const res2 = await fm.fetch(viaBridge(bridgeSrv.url, target))
console.log('  status', res2.status)
console.log('  stranger total', fmt(await usdc(stranger.address)))

// 6. The upstream settles through its facilitator a moment after answering: wait for it, then collect the budget.
step('6. settlement and collection')
for (let i = 0; i < 20 && (await usdc(stranger.address)) < 2_000n; i++) await new Promise((r) => setTimeout(r, 1500))
console.log('  stranger total', fmt(await usdc(stranger.address)), '(2 calls x 0.001)')
const redeemer = createRedeemer({
  chains: ['base-sepolia'],
  store: sellerStore,
  redeemerAccount: owner, // anyone may redeem; the money goes to the payee (the bridge)
  policy: { minAmount: 0n, maxAgeSeconds: 0, safetyBeforeExpiry: 1800 },
  onRedeemed: (e) => console.log('  collected', fmt(e.paid), 'tx', e.txHash),
  onError: (e) => console.log('  redeemer error', e.message),
})
await redeemer.tick({ force: true })
await new Promise((r) => setTimeout(r, 3000))
console.log('  bridge float now', fmt(await usdc(float.address)), '(started 0.020000, paid 0.002, collected 0.002)')

bridgeSrv.server.close()
upstream.server.close()
console.log('\nspike done')
process.exit(0)
