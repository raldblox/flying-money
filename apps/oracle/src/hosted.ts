// The hosted Silk Road Oracle (§21.6): a durable §6.5 seller on Vercel serverless, sharing its state, redeemer lock and
// sweeper through Upstash (§21.5). The same builder runs the local node server (src/main.ts) with hosted = false.
import { createHash, timingSafeEqual } from 'node:crypto'
import { type ChainKey, isChainKey, setLocalDeployment } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import {
  type CertificateReader,
  DurableStoreRequiredError,
  memoryLock,
  type RedeemPolicy,
  redisLock,
  type SellerStore,
  sellerStoreFromEnv,
} from '@flying-money/server'
import { privateKeyToAccount } from 'viem/accounts'
import { createOracle, type WeatherNow } from './app.js'

/**
 * §21.6 (MUST on Hobby, DECISIONS D27): the cron runs at most once a day (±59 min), so the redeemer treats anything
 * within 36 h of expiry as due, and the seller only accepts certificates with at least that long left. A note served at
 * the last moment is then still redeemed by the next daily run (≤ 25 h later), before expiry.
 */
export const HOBBY_SAFETY_SECONDS = 36 * 3600
/** Pro runs the cron every 10 minutes (§21.6), so two hours of margin is plenty. */
export const PRO_SAFETY_SECONDS = 2 * 3600
/**
 * Runs `fn` at most once at a time. A call that arrives while it runs asks for exactly one more run afterwards, so a
 * burst of paid requests always ends with a check that sees the latest state (never dropped, never piled up). Errors
 * go to `onError`: this runs after the response, so it must never throw.
 */
export function coalesce(fn: () => Promise<unknown>, onError: (e: Error) => void = () => {}) {
  let running: Promise<void> | null = null
  let again = false
  const run = (): Promise<void> => {
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
  return Object.assign(run, { idle: () => running ?? Promise.resolve() })
}

export interface HostedOracleOptions {
  accepts: ChainKey[]
  payee: Hex
  seller: SellerStore
  env: Record<string, string | undefined>
  /** True on Vercel: a durable store and CRON_SECRET are required. */
  hosted: boolean
  plan?: 'hobby' | 'pro'
  redeemerKey?: Hex
  cronSecret?: string
  readCertificate?: CertificateReader
  fetchWeather?: (lat: number, lon: number) => Promise<WeatherNow>
  docsUrl?: string
  corsOrigin?: string | string[]
}

export function buildHostedOracle(o: HostedOracleOptions) {
  if (o.hosted && !o.seller.durable) throw new DurableStoreRequiredError('hosted seller')
  const safety = (o.plan ?? 'hobby') === 'hobby' ? HOBBY_SAFETY_SECONDS : PRO_SAFETY_SECONDS
  const policy: RedeemPolicy = { minAmount: 100_000n, maxAgeSeconds: 3600, safetyBeforeExpiry: safety }
  const lock = o.seller.redis ? redisLock(o.seller.redis, o.seller.prefix) : memoryLock()

  const oracle = createOracle({
    accepts: o.accepts,
    payee: o.payee,
    store: o.seller.store,
    env: o.env,
    minRemainingLifetime: safety,
    ...(o.readCertificate ? { readCertificate: o.readCertificate } : {}),
    ...(o.fetchWeather ? { fetchWeather: o.fetchWeather } : {}),
    ...(o.docsUrl ? { docsUrl: o.docsUrl } : {}),
    ...(o.corsOrigin ? { corsOrigin: o.corsOrigin } : {}),
    ...(o.redeemerKey ? { redeemer: { account: privateKeyToAccount(o.redeemerKey), lock, policy } } : {}),
  })

  /** §6.5 sweeper plus one redeemer pass (policy thresholds apply; the lock keeps instances from racing). */
  async function maintain() {
    const swept = await oracle.server.sweep()
    if (oracle.redeemer) await oracle.redeemer.tick()
    return { swept: swept.resolved, running: swept.running, redeemer: Boolean(oracle.redeemer) }
  }

  // Visible in the hosting logs (Vercel): collections and redeemer alerts. An 'error' listener must exist anyway,
  // since an EventEmitter throws on an unheard 'error'.
  oracle.events.on('redeemed', (e) => console.log(`collected ${e.paid} on chain ${e.chainId}: ${e.txHash}`))
  oracle.events.on('error', (e: { chainId?: number; message: string }) =>
    console.error(`redeemer${e.chainId ? ` (chain ${e.chainId})` : ''}: ${e.message}`),
  )

  /** Opportunistic maintenance after serving (§21.6 step 1), coalesced per instance. Never throws. */
  const afterServe = coalesce(maintain, (e) => console.error(`maintenance failed: ${e.message}`))

  const secretOk = (header: string | undefined) => {
    if (!o.cronSecret || !header?.startsWith('Bearer ')) return false
    const a = createHash('sha256').update(header.slice(7)).digest()
    const b = createHash('sha256').update(o.cronSecret).digest()
    return timingSafeEqual(a, b)
  }

  // §21.6 step 2: Vercel Cron calls this with `Authorization: Bearer ${CRON_SECRET}`.
  oracle.app.get('/api/cron/redeem', async (c) => {
    if (!o.cronSecret) return c.json({ error: 'CRON_SECRET is not set on this deployment' }, 503)
    if (!secretOk(c.req.header('authorization'))) return c.json({ error: 'unauthorized' }, 401)
    return c.json(await maintain())
  })

  return { app: oracle.app, oracle, maintain, afterServe, policy, seller: o.seller }
}

/**
 * Builds the Oracle from the environment (.env.example): ORACLE_ACCEPTS, PAYEE_ADDRESS, REDEEMER_KEY (optional),
 * CRON_SECRET, FM_VERCEL_PLAN (hobby | pro), the §21.5 store variables, ORACLE_DOCS_URL, CORS_ORIGIN, and for local anvil
 * FM_ANVIL_USDC / FM_ANVIL_CONTRACT.
 */
export function hostedOracleFromEnv(
  env: Record<string, string | undefined>,
  opts: { hosted: boolean; readCertificate?: CertificateReader },
) {
  const accepts = (env.ORACLE_ACCEPTS ?? 'arbitrum-sepolia').split(',').map((s) => s.trim())
  for (const k of accepts) if (!isChainKey(k)) throw new Error(`ORACLE_ACCEPTS: unknown chain ${k}`)
  if (accepts.includes('anvil')) {
    if (opts.hosted) throw new Error('anvil is local only')
    if (!env.FM_ANVIL_USDC || !env.FM_ANVIL_CONTRACT) throw new Error('anvil needs FM_ANVIL_USDC and FM_ANVIL_CONTRACT')
    setLocalDeployment({ usdc: env.FM_ANVIL_USDC as Hex, flyingMoney: env.FM_ANVIL_CONTRACT as Hex })
  }
  const payee = env.PAYEE_ADDRESS as Hex | undefined
  if (!payee || !/^0x[0-9a-fA-F]{40}$/.test(payee)) throw new Error('PAYEE_ADDRESS is required (human input H3)')
  const seller = sellerStoreFromEnv({ env, payee, accepts: accepts as ChainKey[], requireDurable: opts.hosted })
  return buildHostedOracle({
    accepts: accepts as ChainKey[],
    payee,
    seller,
    env,
    hosted: opts.hosted,
    plan: env.FM_VERCEL_PLAN === 'pro' ? 'pro' : 'hobby',
    ...(env.REDEEMER_KEY ? { redeemerKey: env.REDEEMER_KEY as Hex } : {}),
    ...(env.CRON_SECRET ? { cronSecret: env.CRON_SECRET } : {}),
    ...(opts.readCertificate ? { readCertificate: opts.readCertificate } : {}),
    ...(env.ORACLE_DOCS_URL ? { docsUrl: env.ORACLE_DOCS_URL } : {}),
    ...(env.CORS_ORIGIN ? { corsOrigin: env.CORS_ORIGIN.split(',') } : {}),
  })
}
