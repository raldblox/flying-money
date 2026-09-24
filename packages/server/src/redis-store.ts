import { decodeNote, encodeHeader, type Hex } from '@flying-money/core'
import { Redis as UpstashRedis } from '@upstash/redis'
import { Redis as IORedis, type Redis as IORedisClient } from 'ioredis'
import {
  type CertKey,
  chainOfKey,
  NoStateError,
  type NoteStore,
  normId,
  normKey,
  type PendingRedemption,
  type Submission,
} from './store.js'

/**
 * The only thing the store needs from Redis: EVAL. Every operation is one Lua script, so `begin` and
 * `finish` are single atomic transactions (§8.3). Works with any TCP Redis (ioredis) and with Upstash
 * over HTTPS (Vercel-friendly, DECISIONS D11).
 */
export interface RedisEval {
  eval(script: string, keys: string[], args: string[]): Promise<unknown>
}

export function ioredisEval(client: IORedisClient): RedisEval {
  return { eval: (s, k, a) => client.eval(s, k.length, ...k, ...a) as Promise<unknown> }
}

export function upstashEval(client: UpstashRedis): RedisEval {
  return { eval: (s, k, a) => client.eval(s, k, a) }
}

// Decimal-string arithmetic: Redis Lua numbers are doubles and would lose precision above 2^53.
const LUA_PRELUDE = `
local function strip(s) local r = string.gsub(s, '^0+', '') if r == '' then return '0' end return r end
local function pad(n) return string.rep('0', 78 - #n) .. n end
local function cmp(a, b)
  if #a ~= #b then if #a < #b then return -1 else return 1 end end
  if a == b then return 0 end
  if a < b then return -1 else return 1 end
end
local function add(a, b)
  local res, carry, i, j = {}, 0, #a, #b
  while i > 0 or j > 0 or carry > 0 do
    local s = carry
    if i > 0 then s = s + tonumber(string.sub(a, i, i)) end
    if j > 0 then s = s + tonumber(string.sub(b, j, j)) end
    res[#res + 1] = tostring(s % 10)
    carry = math.floor(s / 10)
    i = i - 1
    j = j - 1
  end
  return strip(string.reverse(table.concat(res)))
end
local function sub(a, b)
  local res, borrow, i, j = {}, 0, #a, #b
  while i > 0 do
    local d = tonumber(string.sub(a, i, i)) - borrow
    if j > 0 then d = d - tonumber(string.sub(b, j, j)) end
    if d < 0 then d = d + 10 borrow = 1 else borrow = 0 end
    res[#res + 1] = tostring(d)
    i = i - 1
    j = j - 1
  end
  return strip(string.reverse(table.concat(res)))
end
`

// KEYS: out, st, notes, pending, certs
// ARGV: price, cumulative, noteHeader, faceValue, nowMs, pendingMember, certKey, requestHash ('' = none)
const BEGIN =
  LUA_PRELUDE +
  `
if redis.call('EXISTS', KEYS[1]) == 1 then return 'DUPLICATE' end
if redis.call('EXISTS', KEYS[2]) == 0 then return 'NO_STATE' end
local st = redis.call('HMGET', KEYS[2], 'accepted', 'consumed', 'reserved')
local price, cum, face = ARGV[1], ARGV[2], ARGV[4]
if cmp(cum, face) > 0 then return 'INSUFFICIENT' end
local budget = st[1]
if cmp(cum, budget) > 0 then budget = cum end
if cmp(add(add(st[2], st[3]), price), budget) > 0 then return 'INSUFFICIENT' end
redis.call('HSET', KEYS[1], 'status', 'PENDING', 'price', price, 'admittedAt', ARGV[5])
if ARGV[8] ~= '' then redis.call('HSET', KEYS[1], 'requestHash', ARGV[8]) end
redis.call('HSET', KEYS[2], 'accepted', budget, 'reserved', add(st[3], price))
local p = pad(cum)
local existing = redis.call('ZRANGEBYLEX', KEYS[3], '[' .. p .. '|', '[' .. p .. '|~', 'LIMIT', 0, 1)
if #existing == 0 then redis.call('ZADD', KEYS[3], 0, p .. '|' .. ARGV[3]) end
redis.call('ZADD', KEYS[4], ARGV[5], ARGV[6])
redis.call('SADD', KEYS[5], ARGV[7])
return 'ADMITTED'
`

// KEYS: out, st, pending   ARGV: ok ('1'|'0'), responseRef ('' = none), nowMs, pendingMember, hasRef ('1'|'0')
const FINISH =
  LUA_PRELUDE +
  `
local o = redis.call('HMGET', KEYS[1], 'status', 'price')
if o[1] ~= 'PENDING' then return 'NOT_PENDING' end
if redis.call('EXISTS', KEYS[2]) == 0 then return 'NOT_PENDING' end
local st = redis.call('HMGET', KEYS[2], 'consumed', 'reserved')
redis.call('HSET', KEYS[2], 'reserved', sub(st[2], o[2]))
if ARGV[1] == '1' then
  redis.call('HSET', KEYS[2], 'consumed', add(st[1], o[2]))
  if redis.call('HEXISTS', KEYS[2], 'oldest') == 0 then redis.call('HSET', KEYS[2], 'oldest', ARGV[3]) end
  redis.call('HSET', KEYS[1], 'status', 'SERVED')
  if ARGV[5] == '1' then redis.call('HSET', KEYS[1], 'responseRef', ARGV[2]) end
else
  redis.call('HSET', KEYS[1], 'status', 'FAILED_CREDITED')
end
redis.call('ZREM', KEYS[3], ARGV[4])
return 'DONE'
`

// KEYS: st, certs   ARGV: redeemedOnChain, status, certKey
const RECOVER = `
if redis.call('EXISTS', KEYS[1]) == 1 then return 0 end
redis.call('HSET', KEYS[1], 'accepted', ARGV[1], 'consumed', ARGV[1], 'reserved', '0', 'status', ARGV[2], 'redeemed', ARGV[1])
redis.call('SADD', KEYS[2], ARGV[3])
return 1
`

// KEYS: st, notes   ARGV: cumulative, txHash
const MARK =
  LUA_PRELUDE +
  `
if redis.call('HEXISTS', KEYS[1], 'consumed') == 0 then return 0 end
local st = redis.call('HMGET', KEYS[1], 'redeemed', 'consumed')
local r = st[1]
if cmp(ARGV[1], r) > 0 then r = ARGV[1] end
redis.call('HSET', KEYS[1], 'redeemed', r, 'lastTx', ARGV[2])
local stale = redis.call('ZRANGEBYLEX', KEYS[2], '-', '(' .. pad(r))
for i = 1, #stale, 500 do
  redis.call('ZREM', KEYS[2], unpack(stale, i, math.min(i + 499, #stale)))
end
if cmp(r, st[2]) >= 0 then redis.call('HDEL', KEYS[1], 'oldest') end
return 1
`

const STATE = `return redis.call('HMGET', KEYS[1], 'accepted', 'consumed', 'reserved', 'status', 'redeemed', 'oldest')`
const OUTCOME = `return redis.call('HMGET', KEYS[1], 'status', 'price', 'responseRef', 'requestHash')`
// KEYS: notes   ARGV: paddedMax
const BEST = `return redis.call('ZREVRANGEBYLEX', KEYS[1], '[' .. ARGV[1] .. '|~', '-', 'LIMIT', 0, 1)`
const STALE = `return redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1])`
const MEMBERS = `return redis.call('SMEMBERS', KEYS[1])`
const GET = `return redis.call('GET', KEYS[1])`
const SET = `if ARGV[1] == '' then return redis.call('DEL', KEYS[1]) end return redis.call('SET', KEYS[1], ARGV[1])`

const pad78 = (n: bigint) => n.toString().padStart(78, '0')
type Bulk = string | null | false | undefined
const str = (v: unknown): string | null => (v === null || v === undefined || v === false ? null : String(v))

export interface RedisStoreOptions {
  /** Key prefix (namespace), default "fm:". */
  prefix?: string
}

export function redisStoreFromEval(r: RedisEval, opts: RedisStoreOptions = {}): NoteStore {
  const P = opts.prefix ?? 'fm:'
  const k = {
    st: (key: CertKey) => `${P}st:${normKey(key)}`,
    notes: (key: CertKey) => `${P}notes:${normKey(key)}`,
    out: (key: CertKey, rid: Hex) => `${P}out:${normKey(key)}:${normId(rid)}`,
    pending: `${P}pending`,
    certs: (chainId: number) => `${P}certs:${chainId}`,
    sub: (chainId: number) => `${P}sub:${chainId}`,
  }
  const member = (key: CertKey, rid: Hex) => `${normKey(key)}|${normId(rid)}`

  const readState = async (key: CertKey) => {
    const a = (await r.eval(STATE, [k.st(key)], [])) as Bulk[]
    const [accepted, consumed, reserved, status, redeemed, oldest] = [0, 1, 2, 3, 4, 5].map((i) => str(a[i]))
    if (accepted == null || consumed == null || reserved == null) return null
    return {
      accepted: BigInt(accepted),
      consumed: BigInt(consumed),
      reserved: BigInt(reserved),
      status: (status === 'RECOVERED' ? 'RECOVERED' : 'OK') as 'OK' | 'RECOVERED',
      redeemed: BigInt(redeemed ?? '0'),
      oldest: oldest == null ? undefined : Number(oldest),
    }
  }

  const bestNote = async (key: CertKey, max: bigint) => {
    const a = (await r.eval(BEST, [k.notes(key)], [pad78(max)])) as Bulk[]
    const m = str(a[0])
    return m ? decodeNote(m.slice(m.indexOf('|') + 1)) : null
  }

  const store: NoteStore = {
    async state(key) {
      const s = await readState(key)
      return s ? { accepted: s.accepted, consumed: s.consumed, reserved: s.reserved, status: s.status } : null
    },
    bestNote,
    async outcome(key, requestId) {
      const a = (await r.eval(OUTCOME, [k.out(key, requestId)], [])) as Bulk[]
      const [status, price, ref, hash] = [0, 1, 2, 3].map((i) => str(a[i]))
      if (status == null || price == null) return null
      return {
        status: status as 'PENDING' | 'SERVED' | 'FAILED_CREDITED',
        price: BigInt(price),
        ...(ref != null ? { responseRef: ref } : {}),
        ...(hash != null ? { requestHash: hash as Hex } : {}),
      }
    },
    async begin(key, requestId, price, note, faceValue, requestHash) {
      const res = str(
        await r.eval(
          BEGIN,
          [k.out(key, requestId), k.st(key), k.notes(key), k.pending, k.certs(chainOfKey(key))],
          [
            price.toString(),
            note.cumulative.toString(),
            encodeHeader(note),
            faceValue.toString(),
            String(Date.now()),
            member(key, requestId),
            normKey(key),
            requestHash?.toLowerCase() ?? '',
          ],
        ),
      )
      if (res === 'NO_STATE') throw new NoStateError(key)
      if (res !== 'ADMITTED' && res !== 'DUPLICATE' && res !== 'INSUFFICIENT') throw new Error(`begin: ${res}`)
      return res
    },
    async finish(key, requestId, ok, responseRef) {
      const res = str(
        await r.eval(
          FINISH,
          [k.out(key, requestId), k.st(key), k.pending],
          [
            ok ? '1' : '0',
            responseRef ?? '',
            String(Date.now()),
            member(key, requestId),
            responseRef !== undefined ? '1' : '0',
          ],
        ),
      )
      if (res !== 'DONE' && res !== 'NOT_PENDING') throw new Error(`finish: ${res}`)
      return res
    },
    async stalePending(olderThanMs) {
      const a = (await r.eval(STALE, [k.pending], [String(Date.now() - olderThanMs)])) as Bulk[]
      return a
        .map(str)
        .filter((m): m is string => m !== null)
        .map((m) => {
          const [key, requestId] = m.split('|') as [CertKey, Hex]
          return { key, requestId }
        })
    },
    async recover(key, redeemedOnChain) {
      await r.eval(
        RECOVER,
        [k.st(key), k.certs(chainOfKey(key))],
        [redeemedOnChain.toString(), redeemedOnChain > 0n ? 'RECOVERED' : 'OK', normKey(key)],
      )
    },
    async markRedeemed(key, cumulative, txHash) {
      await r.eval(MARK, [k.st(key), k.notes(key)], [cumulative.toString(), txHash])
    },
    async pendingRedemptions(chainId) {
      const keys = ((await r.eval(MEMBERS, [k.certs(chainId)], [])) as Bulk[]).map(str).filter(Boolean) as CertKey[]
      const out: PendingRedemption[] = []
      for (const key of keys) {
        const s = await readState(key)
        if (!s) continue
        const n = await bestNote(key, s.consumed)
        if (n && n.cumulative > s.redeemed)
          out.push({
            key,
            note: n,
            redeemedOnChain: s.redeemed,
            ...(s.oldest !== undefined ? { oldestServedAt: s.oldest } : {}),
          })
      }
      return out
    },
    async getSubmission(chainId) {
      const v = str(await r.eval(GET, [k.sub(chainId)], []))
      return v ? (JSON.parse(v) as Submission) : null
    },
    async setSubmission(chainId, s) {
      await r.eval(SET, [k.sub(chainId)], [s ? JSON.stringify(s) : ''])
    },
  }
  return store
}

/** TCP Redis (self-hosted, Redis Cloud, Fly, Railway…). Accepts a URL, an ioredis client, or any RedisEval. */
export function redisStore(target: string | IORedisClient | RedisEval, opts: RedisStoreOptions = {}): NoteStore {
  if (typeof target === 'string') return redisStoreFromEval(ioredisEval(new IORedis(target)), opts)
  const isPlainEval = Object.getPrototypeOf(target) === Object.prototype
  return redisStoreFromEval(isPlainEval ? (target as RedisEval) : ioredisEval(target as IORedisClient), opts)
}

/**
 * Upstash Redis over HTTPS: works in Vercel serverless and edge functions (DECISIONS D11).
 * Pass { url, token } (e.g. UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN) or an existing client created
 * with `automaticDeserialization: false`.
 */
export function upstashStore(
  target: { url: string; token: string } | UpstashRedis,
  opts: RedisStoreOptions = {},
): NoteStore {
  const client =
    target instanceof UpstashRedis
      ? target
      : new UpstashRedis({ url: target.url, token: target.token, automaticDeserialization: false })
  return redisStoreFromEval(upstashEval(client), opts)
}

/**
 * Upstash REST credentials from the environment (BUILD_SPEC §21.5): the Vercel Marketplace integration's
 * KV_REST_API_URL / KV_REST_API_TOKEN first, then UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
 */
export function upstashEnv(
  env: Record<string, string | undefined> = process.env,
): { url: string; token: string } | null {
  if (env.KV_REST_API_URL && env.KV_REST_API_TOKEN) return { url: env.KV_REST_API_URL, token: env.KV_REST_API_TOKEN }
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN)
    return { url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN }
  return null
}
