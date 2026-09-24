import { type ChainKey, getChain } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { Redis as UpstashRedis } from '@upstash/redis'
import { Redis as IORedis } from 'ioredis'
import { memoryStore } from './memory-store.js'
import { ioredisEval, LUA_PRELUDE, type RedisEval, redisStoreFromEval, upstashEval } from './redis-store.js'
import type { NoteStore } from './store.js'

/** A hosted seller (or relay) was started without a durable store (§21.5: it MUST refuse). */
export class DurableStoreRequiredError extends Error {
  constructor(why: string) {
    super(
      `A durable store is required (${why}). Install Upstash from the Vercel Marketplace (KV_REST_API_URL / ` +
        'KV_REST_API_TOKEN), or set UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN or REDIS_URL (§21.5).',
    )
    this.name = 'DurableStoreRequiredError'
  }
}

export type FmEnv = 'testnet' | 'mainnet'

export interface SellerStore {
  store: NoteStore
  /** The Redis connection for locks and rate limits; null for the memory store. */
  redis: RedisEval | null
  prefix: string
  fmEnv: FmEnv
  source: 'KV_REST_API' | 'UPSTASH_REDIS_REST' | 'REDIS_URL' | 'memory'
  durable: boolean
}

/**
 * The seller store from the environment (§21.5, DECISIONS D25/D26). Variables are read in this order, and the first
 * complete set wins: KV_REST_API_URL/TOKEN (the Vercel Marketplace Upstash integration), UPSTASH_REDIS_REST_URL/TOKEN,
 * REDIS_URL. With none, the memory store is returned only when `requireDurable` is false (local development).
 * Keys live under FM_REDIS_PREFIX (default `fm:v1:${FM_ENV}:`), then `s:{payee}:`.
 *
 * Mainnet guards: a seller accepting any mainnet chain needs FM_ENV=mainnet and a prefix containing "mainnet", never
 * runs on memory, and never accepts testnets in the same process (so mainnet never shares storage with previews).
 */
export function sellerStoreFromEnv(opts: {
  env: Record<string, string | undefined>
  payee: Hex
  accepts: ChainKey[]
  requireDurable: boolean
}): SellerStore {
  const { env } = opts
  const fmEnvRaw = env.FM_ENV ?? 'testnet'
  if (fmEnvRaw !== 'testnet' && fmEnvRaw !== 'mainnet')
    throw new Error(`FM_ENV must be testnet or mainnet, not ${fmEnvRaw}`)
  const fmEnv: FmEnv = fmEnvRaw
  const prefix = env.FM_REDIS_PREFIX ?? `fm:v1:${fmEnv}:`
  const mainnets = opts.accepts.filter((k) => getChain(k).mainnet)
  const testnets = opts.accepts.filter((k) => !getChain(k).mainnet)
  if (mainnets.length > 0) {
    if (fmEnv !== 'mainnet') throw new Error(`accepting ${mainnets.join(', ')} requires FM_ENV=mainnet`)
    if (!prefix.includes('mainnet')) throw new Error(`a mainnet seller's key prefix must contain "mainnet" (${prefix})`)
  }
  if (fmEnv === 'mainnet' && testnets.length > 0)
    throw new Error(`FM_ENV=mainnet must not accept testnet chains (${testnets.join(', ')})`)

  const conn = redisFromEnv(env)
  if (conn)
    return {
      store: redisStoreFromEval(conn.redis, { prefix, payee: opts.payee }),
      redis: conn.redis,
      prefix,
      fmEnv,
      source: conn.source,
      durable: true,
    }
  if (opts.requireDurable) throw new DurableStoreRequiredError('hosted seller')
  if (fmEnv === 'mainnet') throw new DurableStoreRequiredError('mainnet seller')
  return { store: memoryStore(), redis: null, prefix, fmEnv, source: 'memory', durable: false }
}

/**
 * The Redis connection from the environment (same order as sellerStoreFromEnv), for locks and rate limits outside a
 * seller, such as the web demo route. Null when no store variables are set. The key prefix is `fm:v1:${FM_ENV}:`.
 */
export function redisFromEnv(
  env: Record<string, string | undefined>,
): { redis: RedisEval; source: Exclude<SellerStore['source'], 'memory'>; prefix: string } | null {
  const prefix = env.FM_REDIS_PREFIX ?? `fm:v1:${env.FM_ENV ?? 'testnet'}:`
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN)
    return { redis: upstashRest(env.KV_REST_API_URL, env.KV_REST_API_TOKEN), source: 'KV_REST_API', prefix }
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)
    return {
      redis: upstashRest(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN),
      source: 'UPSTASH_REDIS_REST',
      prefix,
    }
  if (env.REDIS_URL)
    return { redis: ioredisEval(new IORedis(env.REDIS_URL, { lazyConnect: true })), source: 'REDIS_URL', prefix }
  return null
}

const upstashRest = (url: string, token: string) =>
  upstashEval(new UpstashRedis({ url, token, automaticDeserialization: false }))

// ───────── locks: {p}lock:{name} (SET NX PX, ≤ 5 min) ─────────

export interface Lock {
  /** Returns an owner token, or null if someone else holds the lock. */
  acquire(name: string, ttlMs: number): Promise<string | null>
  /** Releases only if `token` still owns the lock (compare-and-delete). */
  release(name: string, token: string): Promise<void>
}

const ACQUIRE = `return redis.call('SET', KEYS[1], ARGV[1], 'NX', 'PX', ARGV[2])`
const RELEASE = `if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) end return 0`

export function redisLock(r: RedisEval, prefix: string): Lock {
  const key = (name: string) => `${prefix}lock:${name}`
  return {
    async acquire(name, ttlMs) {
      const token = crypto.randomUUID()
      const res = await r.eval(ACQUIRE, [key(name)], [token, String(Math.max(1, Math.min(ttlMs, 300_000)))])
      return res === 'OK' ? token : null
    },
    async release(name, token) {
      await r.eval(RELEASE, [key(name)], [token])
    },
  }
}

/** In-process lock for the memory store (a single instance by definition). */
export function memoryLock(): Lock {
  const held = new Map<string, { token: string; until: number }>()
  return {
    async acquire(name, ttlMs) {
      const h = held.get(name)
      if (h && h.until > Date.now()) return null
      const token = crypto.randomUUID()
      held.set(name, { token, until: Date.now() + ttlMs })
      return token
    },
    async release(name, token) {
      if (held.get(name)?.token === token) held.delete(name)
    },
  }
}

// ───────── rate limits and amount budgets: {p}rl:{scope}:{id} ─────────

const HIT = `
local n = redis.call('INCR', KEYS[1])
if n == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
return n`

// Adds ARGV[1] to the counter only if the total stays ≤ ARGV[2] (decimal strings, exact).
const SPEND =
  LUA_PRELUDE +
  `
local cur = redis.call('GET', KEYS[1]) or '0'
local nxt = add(cur, ARGV[1])
if cmp(nxt, ARGV[2]) > 0 then return {0, cur} end
redis.call('SET', KEYS[1], nxt)
if redis.call('TTL', KEYS[1]) < 0 then redis.call('EXPIRE', KEYS[1], ARGV[3]) end
return {1, nxt}`

export interface RateLimiter {
  /** Counts one hit; ok while the count within the window is ≤ limit. Shared by every instance. */
  hit(scope: string, id: string, limit: number, windowSeconds: number): Promise<{ ok: boolean; count: number }>
  /** Adds `amount` to a budget only if the window's total stays ≤ cap (integer base units, exact). */
  spend(
    scope: string,
    id: string,
    amount: bigint,
    cap: bigint,
    windowSeconds: number,
  ): Promise<{ ok: boolean; used: bigint }>
}

export function rateLimiter(r: RedisEval, prefix: string): RateLimiter {
  const key = (scope: string, id: string) => `${prefix}rl:${scope}:${id}`
  return {
    async hit(scope, id, limit, windowSeconds) {
      const n = Number(await r.eval(HIT, [key(scope, id)], [String(windowSeconds)]))
      return { ok: n <= limit, count: n }
    },
    async spend(scope, id, amount, cap, windowSeconds) {
      const [ok, used] = (await r.eval(
        SPEND,
        [key(scope, id)],
        [amount.toString(), cap.toString(), String(windowSeconds)],
      )) as [number | string, string]
      return { ok: Number(ok) === 1, used: BigInt(used) }
    },
  }
}

/** In-process limiter for development without Redis. */
export function memoryRateLimiter(): RateLimiter {
  const m = new Map<string, { n: bigint; until: number }>()
  const cur = (k: string, windowSeconds: number) => {
    const e = m.get(k)
    if (e && e.until > Date.now()) return e
    const fresh = { n: 0n, until: Date.now() + windowSeconds * 1000 }
    m.set(k, fresh)
    return fresh
  }
  return {
    async hit(scope, id, limit, windowSeconds) {
      const e = cur(`${scope}:${id}`, windowSeconds)
      e.n += 1n
      return { ok: e.n <= BigInt(limit), count: Number(e.n) }
    },
    async spend(scope, id, amount, cap, windowSeconds) {
      const e = cur(`${scope}:${id}`, windowSeconds)
      if (e.n + amount > cap) return { ok: false, used: e.n }
      e.n += amount
      return { ok: true, used: e.n }
    },
  }
}
