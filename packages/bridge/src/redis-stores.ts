import type { RedisEval } from '@flying-money/server'
import type { Ledger, LedgerEntry } from './ledger.js'
import type { Delivered, OutcomeStore } from './outcomes.js'

const MAX_TEXT = 256_000
const OUTCOME_TTL_SECONDS = 30 * 86_400
const LEDGER_KEEP = 1_000

/**
 * What each paid request returned, in Redis, so any serverless instance (and any restart) replays it instead of paying a
 * site twice. Entries expire after 30 days; the seller store's own replay record outlives them for as long as a budget
 * can still be used.
 */
export function redisOutcomes(r: RedisEval, prefix: string): OutcomeStore {
  const key = (id: string) => `${prefix}bridge:outcome:${id.toLowerCase()}`
  return {
    async get(id) {
      const v = await r.eval("return redis.call('GET', KEYS[1])", [key(id)], [])
      if (typeof v !== 'string') return undefined
      try {
        return JSON.parse(v) as Delivered
      } catch {
        return undefined
      }
    },
    async set(id, o) {
      if (o.text.length > MAX_TEXT) return
      await r.eval(
        "return redis.call('SET', KEYS[1], ARGV[1], 'EX', ARGV[2])",
        [key(id)],
        [JSON.stringify(o), String(OUTCOME_TTL_SECONDS)],
      )
    },
  }
}

// totals live in counters (decimal strings, so wei amounts never lose precision) next to a capped list of recent entries
const ADD = `
redis.call('LPUSH', KEYS[1], ARGV[1])
redis.call('LTRIM', KEYS[1], 0, tonumber(ARGV[2]) - 1)
redis.call('SETNX', KEYS[2], ARGV[3])
return 1
`
const BUMP = `
local cur = redis.call('GET', KEYS[1]) or '0'
local function add(a, b)
  local res, carry, i, j = {}, 0, #a, #b
  while i > 0 or j > 0 or carry > 0 do
    local s = carry
    if i > 0 then s = s + tonumber(string.sub(a, i, i)) end
    if j > 0 then s = s + tonumber(string.sub(b, j, j)) end
    table.insert(res, 1, tostring(s % 10))
    carry = math.floor(s / 10)
    i = i - 1
    j = j - 1
  end
  return table.concat(res)
end
redis.call('SET', KEYS[1], add(cur, ARGV[1]))
return 1
`

/** The bridge's activity log in Redis: shared by every instance, so /status is the same wherever it is served. */
export function redisLedger(r: RedisEval, prefix: string, now: () => number = Date.now): Ledger {
  const list = `${prefix}bridge:ledger`
  const counter = (name: string) => `${prefix}bridge:total:${name}`
  const since = `${prefix}bridge:since`
  const bump = (name: string, v: bigint | number) =>
    r.eval(BUMP, [counter(name)], [typeof v === 'bigint' ? v.toString() : String(v)])
  const read = async (name: string) => {
    const v = await r.eval("return redis.call('GET', KEYS[1]) or '0'", [counter(name)], [])
    return BigInt(String(v || '0'))
  }
  return {
    async add(e: LedgerEntry) {
      await r.eval(ADD, [list, since], [JSON.stringify(e), String(LEDGER_KEEP), String(now())])
      if (e.kind === 'paid') {
        await bump('paid', 1)
        await bump('spent', BigInt(e.amount))
        await bump('charged', BigInt(e.price ?? e.amount))
      } else if (e.kind === 'failed') await bump('failed', 1)
      else {
        await bump('collected', BigInt(e.amount))
        await bump('collections', 1)
        await bump('gas', BigInt(e.gas ?? 0))
      }
    },
    async recent(n) {
      const v = await r.eval("return redis.call('LRANGE', KEYS[1], 0, tonumber(ARGV[1]) - 1)", [list], [String(n)])
      if (!Array.isArray(v)) return []
      const out: LedgerEntry[] = []
      for (const line of v) {
        try {
          out.push(JSON.parse(String(line)) as LedgerEntry)
        } catch {
          // skip a corrupt line
        }
      }
      return out
    },
    async totals() {
      const [paid, failed, spent, charged, collected, collections, gas, s] = await Promise.all([
        read('paid'),
        read('failed'),
        read('spent'),
        read('charged'),
        read('collected'),
        read('collections'),
        read('gas'),
        r.eval("return redis.call('GET', KEYS[1]) or '0'", [since], []),
      ])
      return {
        paid: Number(paid),
        failed: Number(failed),
        spent,
        charged,
        collected,
        collections: Number(collections),
        gas,
        since: Number(s) || now(),
      }
    },
  }
}
