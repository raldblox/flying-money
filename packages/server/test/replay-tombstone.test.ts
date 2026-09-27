import { certKey, newRequestId } from '@flying-money/core'
import RedisMock from 'ioredis-mock'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { createFlyingMoneyServer, type ExecResult, redisStore } from '../src/index.js'
import { CHAIN_ID, Clock, FakeChain, note, payee } from './fixtures.js'

// BUILD_SPEC §22.2 A1 (S1): the stored response may be evicted after 30 days, but a certificate can live up to 365
// days. A replay after eviction must never be admitted as new: a tombstone kept with the certificate answers
// 410 outcome-expired, charges nothing and never runs the handler — after a restart and an extension too.
const DAY = 86_400n

describe('A1: replay protection outlives the response cache', () => {
  it('a replay after the outcome is evicted is refused (410), charges nothing, and never re-runs the handler', async () => {
    const redis = new RedisMock()
    const prefix = `t:${Math.random().toString(36).slice(2)}:`
    const chain = new FakeChain()
    const clock = new Clock()
    const spenderKey = generatePrivateKey()
    const cert = chain.issue({
      faceValue: 1_000n,
      expiresAt: BigInt(clock.t) + 60n * DAY,
      spender: privateKeyToAccount(spenderKey).address,
    })
    const make = () =>
      createFlyingMoneyServer({
        accepts: ['anvil'],
        payee: payee.address,
        store: redisStore(redis as never, { prefix }),
        readCertificate: chain.reader,
        now: clock.now,
      })
    let runs = 0
    const exec = async (): Promise<ExecResult> => {
      runs++
      return { ok: true, responseRef: '"weather"' }
    }
    // an earlier failed request left credit: this note carries cumulative 20 for a purchase of 10
    const memo = newRequestId()
    const n = await note(spenderKey, cert.id, 20n, memo)
    const first = await make().handle({ noteHeader: n.header, price: 10n }, exec)
    expect(first.status).toBe(200)
    expect(runs).toBe(1)

    // model the 30-day TTL: every cached outcome for this certificate disappears
    const outKeys = await redis.keys(`${prefix}*out:*`)
    expect(outKeys.length).toBeGreaterThan(0)
    await redis.del(...outKeys)

    const replay = await make().handle({ noteHeader: n.header, price: 10n }, exec)
    expect(replay).toMatchObject({ kind: 'error', status: 410 })
    expect(runs).toBe(1)

    // after an extension and on a fresh process: still refused
    const c = chain.certs.get(cert.id.toLowerCase()) ?? chain.certs.get(cert.id)
    if (c) c.expiresAt = BigInt(clock.t) + 300n * DAY
    expect((await make().handle({ noteHeader: n.header, price: 10n }, exec)).status).toBe(410)
    expect(runs).toBe(1)

    const store = redisStore(redis as never, { prefix })
    const st = await store.state(certKey(CHAIN_ID, cert.id))
    expect(st).toMatchObject({ consumed: 10n, reserved: 0n })

    // a genuinely new purchase still works (the remaining credit pays for it)
    const next = await note(spenderKey, cert.id, 20n, newRequestId())
    expect((await make().handle({ noteHeader: next.header, price: 10n }, exec)).status).toBe(200)
    expect(runs).toBe(2)
    expect(await store.state(certKey(CHAIN_ID, cert.id))).toMatchObject({ consumed: 20n })
  })

  it('a tombstone still binds the request: another request replaying the evicted note is refused too', async () => {
    const redis = new RedisMock()
    const prefix = `t:${Math.random().toString(36).slice(2)}:`
    const chain = new FakeChain()
    const clock = new Clock()
    const spenderKey = generatePrivateKey()
    const cert = chain.issue({
      faceValue: 1_000n,
      expiresAt: BigInt(clock.t) + 60n * DAY,
      spender: privateKeyToAccount(spenderKey).address,
    })
    const server = createFlyingMoneyServer({
      accepts: ['anvil'],
      payee: payee.address,
      store: redisStore(redis as never, { prefix }),
      readCertificate: chain.reader,
      now: clock.now,
    })
    let runs = 0
    const exec = async (): Promise<ExecResult> => {
      runs++
      return { ok: true, responseRef: '"x"' }
    }
    const n = await note(spenderKey, cert.id, 10n)
    await server.handle({ noteHeader: n.header, price: 10n, requestHash: `0x${'aa'.repeat(32)}` }, exec)
    await redis.del(...(await redis.keys(`${prefix}*out:*`)))
    const other = await server.handle({ noteHeader: n.header, price: 10n, requestHash: `0x${'bb'.repeat(32)}` }, exec)
    expect(other.status).toBe(409)
    expect(runs).toBe(1)
  })
})
