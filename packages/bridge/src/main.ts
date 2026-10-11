#!/usr/bin/env node
// flying-money-bridge: a self-hosted bridge that lets agents pay ordinary x402 sites from a Flying Money budget.
//   BRIDGE_FLOAT_KEY          the bridge's wallet (0x + 64 hex): pays sites, and is the payee of budgets made for it
//   BRIDGE_CHAINS             Flying Money chains whose budgets it accepts, comma-separated (default base-sepolia)
//   BRIDGE_UPSTREAM_NETWORKS  CAIP-2 networks it will pay on (default: the chains above, as eip155:<id>)
//   BRIDGE_MAX_UPSTREAM       most it pays any site per call, in USDC (default 0.05)
//   BRIDGE_FEE_BPS            fee on top of the site's price, basis points (default 0)
//   BRIDGE_ALLOW_HOSTS        optional comma list: reach only these hostnames
//   BRIDGE_REDEEM_MIN / _MAX_AGE  collect when this much (USDC, default 0.05) or this many seconds (default 600) are waiting
//   BRIDGE_NOTES_FILE         durable file for the seller's accepted notes (one self-hosted process; Redis/Upstash for several)
//   BRIDGE_STATE_FILE         JSON file remembering what each paid request returned (so a restart never pays a site twice)
//   BRIDGE_TRUST_PROXY=1      take the client address from X-Forwarded-For (only behind your own proxy)
//   PORT                      default 8790
//   BRIDGE_DEV=1              memory store; with BRIDGE_ALLOW_LOCAL=1 it may also call sites on this machine (tests only)
//   REDIS_URL / KV_REST_API_*  durable store (required unless BRIDGE_DEV=1); BRIDGE_REDEEM=1 also collects budgets
//                              automatically (needs gas on the budget chain)
import { type ChainKey, getChain, isChainKey, rpcUrl } from '@flying-money/chains'
import { memoryStore, sellerStoreFromEnv, startRedeemer } from '@flying-money/server'
import { serve } from '@hono/node-server'
import { createPublicClient, erc20Abi, http, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createBridge } from './bridge.js'
import { fileNoteStore } from './file-store.js'
import { fileOutcomes, memoryOutcomes } from './outcomes.js'

const env = process.env
const key = env.BRIDGE_FLOAT_KEY?.trim()
if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) {
  console.error('flying-money-bridge: set BRIDGE_FLOAT_KEY (0x + 64 hex), the wallet that pays sites')
  process.exit(1)
}
const float = privateKeyToAccount(key as `0x${string}`)
const chains = (env.BRIDGE_CHAINS ?? 'base-sepolia').split(',').map((s) => s.trim()) as ChainKey[]
for (const c of chains) if (!isChainKey(c)) throw new Error(`unknown chain in BRIDGE_CHAINS: ${c}`)
const upstreamNetworks = (env.BRIDGE_UPSTREAM_NETWORKS ?? chains.map((c) => `eip155:${getChain(c).chain.id}`).join(','))
  .split(',')
  .map((s) => s.trim())
const dev = env.BRIDGE_DEV === '1'
// Durable store: Redis/Upstash for several instances, or BRIDGE_NOTES_FILE for one self-hosted process. A mainnet bridge
// never runs on memory (its accepted notes are money owed to it): BRIDGE_DEV=1 is refused when a mainnet is listed.
const mainnetChains = chains.filter((c) => getChain(c).mainnet)
if (dev && mainnetChains.length > 0) {
  console.error(
    `flying-money-bridge: BRIDGE_DEV=1 (memory store) is not allowed with a mainnet (${mainnetChains.join(', ')})`,
  )
  process.exit(1)
}
const redisConfigured = Boolean(env.REDIS_URL || env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL)
const sellerStore = dev
  ? { store: memoryStore(), durable: false }
  : env.BRIDGE_NOTES_FILE && !redisConfigured
    ? { store: fileNoteStore(env.BRIDGE_NOTES_FILE), durable: true }
    : sellerStoreFromEnv({ env, payee: float.address, accepts: chains, requireDurable: true })

/** The float's USDC balance on each network it pays on, so it refuses a quote it could not fund. */
const readers = new Map<string, () => Promise<bigint>>()
for (const k of chains) {
  const c = getChain(k)
  const pub = createPublicClient({ chain: c.chain, transport: http(rpcUrl(k, env)) })
  readers.set(`eip155:${c.chain.id}`, () =>
    pub.readContract({ address: c.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [float.address] }),
  )
}

const bridge = createBridge({
  outcomes: env.BRIDGE_STATE_FILE ? fileOutcomes(env.BRIDGE_STATE_FILE) : memoryOutcomes(),
  trustProxy: env.BRIDGE_TRUST_PROXY === '1',
  floatBalance: async (network) => (await readers.get(network)?.()) ?? 0n,
  accepts: chains,
  float,
  store: sellerStore.store,
  env,
  upstreamNetworks,
  maxUpstreamAmount: parseUnits(env.BRIDGE_MAX_UPSTREAM ?? '0.05', 6),
  feeBps: Number(env.BRIDGE_FEE_BPS ?? 0),
  ...(dev && env.BRIDGE_ALLOW_LOCAL === '1'
    ? { target: { allowLocal: true } } // local testing only: lets the bridge call a site on this machine
    : env.BRIDGE_ALLOW_HOSTS
      ? { target: { allowHosts: env.BRIDGE_ALLOW_HOSTS.split(',').map((s) => s.trim()) } }
      : {}),
})
bridge.server.startSweeper()
if (env.BRIDGE_REDEEM === '1') {
  startRedeemer({
    chains,
    store: sellerStore.store,
    redeemerAccount: float,
    env,
    policy: {
      minAmount: parseUnits(env.BRIDGE_REDEEM_MIN ?? '0.05', 6),
      maxAgeSeconds: Number(env.BRIDGE_REDEEM_MAX_AGE ?? 600),
      safetyBeforeExpiry: 3600,
    },
    onRedeemed: (e) => console.log(`collected ${e.paid} from budget ${e.certificateId} (tx ${e.txHash})`),
    onError: (e, chainId) => console.error(`collection problem on chain ${chainId}: ${e.message}`),
  })
}
const port = Number(env.PORT ?? 8790)
serve({ fetch: bridge.app.fetch, port, hostname: env.HOST ?? '127.0.0.1' })
console.log(`flying-money-bridge on http://${env.HOST ?? '127.0.0.1'}:${port}`)
console.log(`payee (issue budgets to this address, spender = your agent): ${float.address}`)
console.log(`budget chains: ${chains.join(', ')}; pays on: ${upstreamNetworks.join(', ')}`)
console.log(dev ? 'DEV mode: memory store, not safe to restart' : 'store: durable')
if (!env.BRIDGE_STATE_FILE && !dev) console.log('tip: set BRIDGE_STATE_FILE so a restart never pays a site twice')
