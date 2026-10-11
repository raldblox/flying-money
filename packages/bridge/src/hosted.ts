// The hosted bridge: the same bridge, run as serverless functions (Vercel), with its state in Redis (Upstash) so that every
// instance sees one accepted-notes store, one set of replay records, one activity log and one collection lock.
// Collection runs from a cron job plus a coalesced pass after each paid response, with the redeemer's safety margin sized
// to how often the cron runs (like the demo seller).
import { createHash, timingSafeEqual } from 'node:crypto'
import { type ChainKey, getChain, isChainKey } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import {
  createRedeemer,
  DurableStoreRequiredError,
  type RedeemPolicy,
  rateLimiter,
  redisLock,
  sellerStoreFromEnv,
} from '@flying-money/server'
import { parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createBridge } from './bridge.js'
import { chainReaders, logCollection } from './readers.js'
import { redisLedger, redisOutcomes } from './redis-stores.js'
import { bridgeSkillMd } from './skill.js'

/** The cron runs at most once a day on Hobby, so budgets need at least this long left, and are collected well before. */
export const HOBBY_SAFETY_SECONDS = 36 * 3600
export const PRO_SAFETY_SECONDS = 2 * 3600

/** Runs `fn` at most once at a time; a call that arrives meanwhile asks for exactly one more run afterwards. Never throws. */
function coalesce(fn: () => Promise<unknown>, onError: (e: Error) => void) {
  let running: Promise<void> | null = null
  let again = false
  return (): Promise<void> => {
    if (running) {
      again = true
      return running
    }
    running = (async () => {
      do {
        again = false
        try {
          await fn()
        } catch (e) {
          onError(e as Error)
        }
      } while (again)
    })().finally(() => {
      running = null
    })
    return running
  }
}

/**
 * Builds the hosted bridge from the environment:
 *   BRIDGE_FLOAT_KEY (secret), BRIDGE_CHAINS, BRIDGE_UPSTREAM_NETWORKS, BRIDGE_MAX_UPSTREAM, BRIDGE_FEE_BPS, BRIDGE_FEE_FLAT,
 *   BRIDGE_REDEEMER_KEY (optional gas-only key), BRIDGE_LABEL, CRON_SECRET, FM_VERCEL_PLAN (hobby | pro),
 *   FM_ENV=mainnet and FM_REDIS_PREFIX containing "mainnet" for a mainnet, and the Redis variables (KV_REST_API_URL/TOKEN).
 */
export function hostedBridgeFromEnv(
  env: Record<string, string | undefined>,
  opts: { hosted: boolean } = { hosted: true },
) {
  const key = env.BRIDGE_FLOAT_KEY?.trim()
  if (!key || !/^0x[0-9a-fA-F]{64}$/.test(key)) throw new Error('BRIDGE_FLOAT_KEY is required (0x + 64 hex)')
  const float = privateKeyToAccount(key as Hex)
  const chains = (env.BRIDGE_CHAINS ?? 'base-sepolia').split(',').map((s) => s.trim())
  for (const c of chains) if (!isChainKey(c)) throw new Error(`BRIDGE_CHAINS: unknown chain ${c}`)
  const accepts = chains as ChainKey[]
  const upstreamNetworks = (
    env.BRIDGE_UPSTREAM_NETWORKS ?? accepts.map((c) => `eip155:${getChain(c).chain.id}`).join(',')
  )
    .split(',')
    .map((s) => s.trim())

  const seller = sellerStoreFromEnv({ env, payee: float.address, accepts, requireDurable: opts.hosted })
  if (opts.hosted && !seller.durable) throw new DurableStoreRequiredError('hosted bridge')
  if (!seller.redis)
    throw new Error('the hosted bridge needs Redis (set the KV_REST_API_URL and KV_REST_API_TOKEN variables)')
  const redis = seller.redis
  const lock = redisLock(redis, seller.prefix)
  const ledger = redisLedger(redis, seller.prefix)
  const readers = chainReaders(accepts, float.address, env)
  const plan = env.FM_VERCEL_PLAN === 'pro' ? 'pro' : 'hobby'
  const safety = plan === 'hobby' ? HOBBY_SAFETY_SECONDS : PRO_SAFETY_SECONDS
  const feeBps = Number(env.BRIDGE_FEE_BPS ?? 0)
  const feeFlat = parseUnits(env.BRIDGE_FEE_FLAT ?? '0', 6)
  const maxUpstreamAmount = parseUnits(env.BRIDGE_MAX_UPSTREAM ?? '0.01', 6)
  const label = env.BRIDGE_LABEL?.trim() || 'Flying Money x402 bridge'

  const bridge = createBridge({
    accepts,
    float,
    store: seller.store,
    env,
    upstreamNetworks,
    maxUpstreamAmount,
    feeBps,
    feeFlat,
    label,
    ledger,
    outcomes: redisOutcomes(redis, seller.prefix),
    rateLimiter: rateLimiter(redis, seller.prefix),
    trustProxy: true, // behind the host's proxy the client address is the first X-Forwarded-For
    minRemainingLifetime: safety,
    floatBalance: readers.usdc,
    gasBalance: readers.gas,
  })

  // one daily cron on Hobby: anything owed for a day, or a budget within the safety margin of ending, is due; a larger owed
  // amount is collected as soon as a pass sees it
  const policy: RedeemPolicy = {
    minAmount: parseUnits(env.BRIDGE_REDEEM_MIN ?? '1', 6),
    maxAgeSeconds: Number(env.BRIDGE_REDEEM_MAX_AGE ?? (plan === 'hobby' ? 20 * 3600 : 86_400)),
    safetyBeforeExpiry: Number(env.BRIDGE_REDEEM_SAFETY ?? safety),
  }
  const redeemer = createRedeemer({
    chains: accepts,
    store: seller.store,
    redeemerAccount: env.BRIDGE_REDEEMER_KEY ? privateKeyToAccount(env.BRIDGE_REDEEMER_KEY as Hex) : float,
    env,
    lock,
    policy,
    onRedeemed: (e) => {
      console.log(`collected ${e.paid} on chain ${e.chainId}: ${e.txHash}`)
      void logCollection(ledger, accepts, env, e)
    },
    onError: (e, chainId) => console.error(`collection problem on chain ${chainId}: ${e.message}`),
  })

  async function maintain() {
    const swept = await bridge.server.sweep()
    await redeemer.tick()
    return { swept: swept.resolved, running: swept.running }
  }
  const afterServe = coalesce(maintain, (e) => console.error(`maintenance failed: ${e.message}`))

  const secretOk = (header: string | undefined) => {
    if (!env.CRON_SECRET || !header?.startsWith('Bearer ')) return false
    const a = createHash('sha256').update(header.slice(7)).digest()
    const b = createHash('sha256').update(env.CRON_SECRET).digest()
    return timingSafeEqual(a, b)
  }
  // the host's cron calls this with `Authorization: Bearer ${CRON_SECRET}`
  bridge.app.get('/api/cron/collect', async (c) => {
    if (!env.CRON_SECRET) return c.json({ error: 'CRON_SECRET is not set on this deployment' }, 503)
    if (!secretOk(c.req.header('authorization'))) return c.json({ error: 'unauthorized' }, 401)
    return c.json(await maintain())
  })

  // a one-file skill for agents, served by the bridge itself
  const skill = (base: string) =>
    bridgeSkillMd({
      base,
      wallet: float.address,
      budgetChains: accepts,
      maxPerCall: maxUpstreamAmount,
      feeBps,
      feeFlat,
      label,
    })
  bridge.app.get('/skill.md', (c) => {
    const base = env.BRIDGE_PUBLIC_URL?.trim() || new URL(c.req.url).origin
    return c.text(skill(base), 200, { 'content-type': 'text/markdown; charset=utf-8' })
  })

  return { app: bridge.app, bridge, maintain, afterServe, policy, wallet: float.address }
}
