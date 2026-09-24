import { Redis as UpstashRedis } from '@upstash/redis'
import RedisMock from 'ioredis-mock'
import { describe, expect, it } from 'vitest'
import {
  DurableStoreRequiredError,
  ioredisEval,
  rateLimiter,
  redisLock,
  sellerStoreFromEnv,
  upstashEnv,
  upstashEval,
} from '../src/index.js'

const payee = '0x00000000000000000000000000000000000000aa'
const up = { KV_REST_API_URL: 'https://kv.example', KV_REST_API_TOKEN: 't1' }

// §21.5 (D25, D26): which store a hosted seller gets, and when it must refuse to start.
describe('sellerStoreFromEnv', () => {
  it('refuses to start without a durable store when one is required; memory only for local development', () => {
    expect(() => sellerStoreFromEnv({ env: {}, payee, accepts: ['arbitrum-sepolia'], requireDurable: true })).toThrow(
      DurableStoreRequiredError,
    )
    const dev = sellerStoreFromEnv({ env: {}, payee, accepts: ['arbitrum-sepolia'], requireDurable: false })
    expect(dev).toMatchObject({ source: 'memory', durable: false, fmEnv: 'testnet' })
  })

  it('reads KV_REST_API_* first, then UPSTASH_REDIS_REST_*, then REDIS_URL; prefix fm:v1:${FM_ENV}:', () => {
    const both = {
      ...up,
      UPSTASH_REDIS_REST_URL: 'https://other.example',
      UPSTASH_REDIS_REST_TOKEN: 't2',
      REDIS_URL: 'redis://x',
    }
    const a = sellerStoreFromEnv({ env: both, payee, accepts: ['arbitrum-sepolia'], requireDurable: true })
    expect(a).toMatchObject({ source: 'KV_REST_API', durable: true, prefix: 'fm:v1:testnet:' })
    const b = sellerStoreFromEnv({
      env: { UPSTASH_REDIS_REST_URL: 'https://other.example', UPSTASH_REDIS_REST_TOKEN: 't2' },
      payee,
      accepts: ['arbitrum-sepolia'],
      requireDurable: true,
    })
    expect(b.source).toBe('UPSTASH_REDIS_REST')
    const c = sellerStoreFromEnv({
      env: { ...up, FM_REDIS_PREFIX: 'fm:custom:testnet:' },
      payee,
      accepts: ['arbitrum-sepolia'],
      requireDurable: true,
    })
    expect(c.prefix).toBe('fm:custom:testnet:')
  })

  it('mainnet guards: FM_ENV=mainnet and a "mainnet" prefix for mainnet chains, and never mixed with testnets', () => {
    const mk = (env: Record<string, string>, accepts: Parameters<typeof sellerStoreFromEnv>[0]['accepts']) => () =>
      sellerStoreFromEnv({ env: { ...up, ...env }, payee, accepts, requireDurable: true })
    expect(mk({}, ['arbitrum'])).toThrow(/FM_ENV/)
    expect(mk({ FM_ENV: 'mainnet', FM_REDIS_PREFIX: 'fm:v1:prod:' }, ['arbitrum'])).toThrow(/prefix/)
    expect(mk({ FM_ENV: 'mainnet' }, ['arbitrum', 'arbitrum-sepolia'])).toThrow(/testnet/)
    expect(mk({ FM_ENV: 'staging' }, ['arbitrum-sepolia'])).toThrow(/FM_ENV/)
    expect(mk({ FM_ENV: 'mainnet' }, ['arbitrum'])()).toMatchObject({ fmEnv: 'mainnet', prefix: 'fm:v1:mainnet:' })
    // a mainnet seller never runs on memory, even in development
    expect(() =>
      sellerStoreFromEnv({ env: { FM_ENV: 'mainnet' }, payee, accepts: ['arbitrum'], requireDurable: false }),
    ).toThrow(DurableStoreRequiredError)
  })
})

describe('redisLock and rateLimiter ({p}lock:*, {p}rl:*)', () => {
  it('a lock is held by one owner at a time, released only by its owner, and expires', async () => {
    const r = ioredisEval(new RedisMock())
    const lock = redisLock(r, 'fm:v1:testnet:')
    const a = await lock.acquire('redeemer:421614', 60_000)
    expect(a).toBeTruthy()
    expect(await lock.acquire('redeemer:421614', 60_000)).toBeNull()
    expect(await lock.acquire('redeemer:1', 60_000)).toBeTruthy() // other names are independent
    await lock.release('redeemer:421614', 'not-the-owner')
    expect(await lock.acquire('redeemer:421614', 60_000)).toBeNull()
    await lock.release('redeemer:421614', a!)
    const b = await lock.acquire('redeemer:421614', 50)
    expect(b).toBeTruthy()
    await new Promise((res) => setTimeout(res, 120))
    expect(await lock.acquire('redeemer:421614', 60_000)).toBeTruthy() // expired
  })

  it('a rate limit allows `limit` hits per window, shared by every instance', async () => {
    const redis = new RedisMock()
    const one = rateLimiter(ioredisEval(redis), 'fm:v1:testnet:')
    const two = rateLimiter(ioredisEval(redis), 'fm:v1:testnet:') // a second serverless instance
    const results = []
    for (let i = 0; i < 5; i++) results.push((await (i % 2 ? one : two).hit('demo-ip', '1.2.3.4', 3, 60)).ok)
    expect(results).toEqual([true, true, true, false, false])
    expect((await one.hit('demo-ip', '5.6.7.8', 3, 60)).ok).toBe(true)
    expect(await redis.ttl('fm:v1:testnet:rl:demo-ip:1.2.3.4')).toBeGreaterThan(0)
  })

  it('amount budgets: a shared daily cap in base units', async () => {
    const rl = rateLimiter(ioredisEval(new RedisMock()), 'fm:v1:testnet:')
    expect((await rl.spend('demo-usdc', 'day', 300_000n, 1_000_000n, 86_400)).ok).toBe(true)
    expect((await rl.spend('demo-usdc', 'day', 600_000n, 1_000_000n, 86_400)).ok).toBe(true)
    const third = await rl.spend('demo-usdc', 'day', 300_000n, 1_000_000n, 86_400)
    expect(third).toMatchObject({ ok: false, used: 900_000n }) // refused: nothing added
  })
})

const upEnv = upstashEnv()
describe.skipIf(!upEnv)('redisLock and rateLimiter on Upstash (real EVAL over HTTPS)', { timeout: 60_000 }, () => {
  it('SET NX PX lock, compare-and-delete release, and exact amount budgets', async () => {
    const client = new UpstashRedis({ ...upEnv!, automaticDeserialization: false })
    const prefix = `fm:test:${Math.random().toString(36).slice(2)}:`
    try {
      const lock = redisLock(upstashEval(client), prefix)
      const a = await lock.acquire('redeemer:421614', 30_000)
      expect(a).toBeTruthy()
      expect(await lock.acquire('redeemer:421614', 30_000)).toBeNull()
      await lock.release('redeemer:421614', a!)
      expect(await lock.acquire('redeemer:421614', 30_000)).toBeTruthy()
      const rl = rateLimiter(upstashEval(client), prefix)
      expect((await rl.spend('demo-usdc', 'day', 2n ** 60n, 2n ** 61n, 60)).ok).toBe(true)
      expect(await rl.spend('demo-usdc', 'day', 2n ** 60n + 1n, 2n ** 61n, 60)).toMatchObject({
        ok: false,
        used: 2n ** 60n,
      })
    } finally {
      const keys = await client.keys(`${prefix}*`)
      if (keys.length) await client.del(...keys)
    }
  })
})
