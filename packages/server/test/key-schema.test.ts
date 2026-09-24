import { certKey, newRequestId } from '@flying-money/core'
import RedisMock from 'ioredis-mock'
import { generatePrivateKey } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { redisStore } from '../src/index.js'
import { CHAIN_ID, note } from './fixtures.js'

// §21.5 key schema (D25): everything under {p}s:{payee}:{chainId}:… so sellers and chains never share keys.
describe('redis key schema (§21.5)', () => {
  it('writes seller keys under {p}s:{payee}:{chainId}:{certId}:… and expires final outcomes after 30 days', async () => {
    const redis = new RedisMock()
    const p = `fm:v1:testnet:${Math.random().toString(36).slice(2)}:`
    const payee = '0x00000000000000000000000000000000000000AA'
    const s = redisStore(redis, { prefix: p, payee })
    const cid = newRequestId()
    const key = certKey(CHAIN_ID, cid)
    await s.recover(key, 0n)
    const n = await note(generatePrivateKey(), cid, 10n)
    await s.begin(key, n.signed.memo, 10n, n.signed, 100n)
    await s.finish(key, n.signed.memo, true, 'r')
    await s.setSubmission(CHAIN_ID, { txHash: `0x${'1'.repeat(64)}`, keys: [key], nonce: 1 })

    const base = `${p}s:${payee.toLowerCase()}:${CHAIN_ID}:`
    const cert = `${base}${cid.toLowerCase()}:`
    const keys = (await redis.keys(`${p}*`)).sort()
    expect(keys).toEqual(
      [
        `${cert}notes`,
        `${cert}out:${n.signed.memo.toLowerCase()}`,
        `${cert}state`,
        `${base}certs`,
        `${base}sub`,
        `${p}s:${payee.toLowerCase()}:pending`,
      ].sort(),
    )
    expect(await redis.type(`${base}sub`)).toBe('hash')
    const ttl = await redis.ttl(`${cert}out:${n.signed.memo.toLowerCase()}`)
    expect(ttl).toBeGreaterThan(29 * 86_400)
    expect(ttl).toBeLessThanOrEqual(30 * 86_400)
    expect(await redis.ttl(`${cert}state`)).toBe(-1) // seller state never expires
  })

  it('two payees on one database never see each other', async () => {
    const redis = new RedisMock()
    const p = `fm:v1:testnet:${Math.random().toString(36).slice(2)}:`
    const a = redisStore(redis, { prefix: p, payee: '0x00000000000000000000000000000000000000aa' })
    const b = redisStore(redis, { prefix: p, payee: '0x00000000000000000000000000000000000000bb' })
    const key = certKey(CHAIN_ID, newRequestId())
    await a.recover(key, 0n)
    expect(await b.state(key)).toBeNull()
  })
})
