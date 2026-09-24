import { getChain, setLocalDeployment } from '@flying-money/chains'
import {
  type Certificate,
  certificateId,
  decodeOffer,
  encodeHeader,
  type Hex,
  NOTE_HEADER,
  newRequestId,
  OFFER_HEADER,
  signNote,
} from '@flying-money/core'
import { DurableStoreRequiredError, ioredisEval, redisStore, type SellerStore } from '@flying-money/server'
import RedisMock from 'ioredis-mock'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { buildHostedOracle, coalesce, HOBBY_SAFETY_SECONDS, hostedOracleFromEnv } from '../src/hosted.js'

const CONTRACT: Hex = '0x00000000000000000000000000000000000f1f1f'
setLocalDeployment({ usdc: '0x00000000000000000000000000000000000c0c0c', flyingMoney: CONTRACT })
const CHAIN_ID = getChain('anvil').chain.id
const payee = privateKeyToAccount(generatePrivateKey()).address

function redisSeller(redis = new RedisMock()): SellerStore {
  const prefix = `fm:v1:testnet:${Math.random().toString(36).slice(2)}:`
  return {
    store: redisStore(redis, { prefix, payee }),
    redis: ioredisEval(redis),
    prefix,
    fmEnv: 'testnet',
    source: 'REDIS_URL',
    durable: true,
  }
}

// §21.5–21.6 (D25–D27): the hosted testnet seller on Vercel.
describe('hosted Oracle', () => {
  it('refuses to start without a durable store (and without PAYEE_ADDRESS)', () => {
    expect(() =>
      hostedOracleFromEnv({ ORACLE_ACCEPTS: 'arbitrum-sepolia', PAYEE_ADDRESS: payee }, { hosted: true }),
    ).toThrow(DurableStoreRequiredError)
    expect(() => hostedOracleFromEnv({ ORACLE_ACCEPTS: 'arbitrum-sepolia' }, { hosted: false })).toThrow(
      /PAYEE_ADDRESS/,
    )
    const memorySeller: SellerStore = { ...redisSeller(), durable: false, source: 'memory', redis: null }
    expect(() =>
      buildHostedOracle({ accepts: ['anvil'], payee, seller: memorySeller, env: {}, hosted: true, cronSecret: 's' }),
    ).toThrow(DurableStoreRequiredError)
  })

  it('on Hobby (daily cron): redeems from 36 h before expiry and only serves certificates with ≥ 36 h left', async () => {
    const h = buildHostedOracle({
      accepts: ['anvil'],
      payee,
      seller: redisSeller(),
      env: {},
      hosted: true,
      cronSecret: 's',
    })
    expect(h.policy.safetyBeforeExpiry).toBe(HOBBY_SAFETY_SECONDS)
    expect(HOBBY_SAFETY_SECONDS).toBeGreaterThanOrEqual(36 * 3600)
    const r = await h.app.request('http://oracle.test/v1/proverb')
    expect(r.status).toBe(402)
    expect(decodeOffer(r.headers.get(OFFER_HEADER)!).minRemainingLifetime).toBeGreaterThanOrEqual(HOBBY_SAFETY_SECONDS)
  })

  it('cron: /api/cron/redeem needs the CRON_SECRET bearer; a hosted deploy without one refuses', async () => {
    const h = buildHostedOracle({
      accepts: ['anvil'],
      payee,
      seller: redisSeller(),
      env: {},
      hosted: true,
      cronSecret: 'c'.repeat(32),
    })
    const call = (auth?: string) =>
      h.app.request('http://oracle.test/api/cron/redeem', auth ? { headers: { authorization: auth } } : {})
    expect((await call()).status).toBe(401)
    expect((await call('Bearer wrong')).status).toBe(401)
    const ok = await call(`Bearer ${'c'.repeat(32)}`)
    expect(ok.status).toBe(200)
    expect(await ok.json()).toMatchObject({ swept: 0, redeemer: false })
    const noSecret = buildHostedOracle({ accepts: ['anvil'], payee, seller: redisSeller(), env: {}, hosted: true })
    expect((await noSecret.app.request('http://oracle.test/api/cron/redeem')).status).toBe(503)
  })

  it('serves paid calls against the durable store under the §21.5 key schema', async () => {
    const redis = new RedisMock()
    const seller = redisSeller(redis)
    const spenderKey = generatePrivateKey()
    const funder = privateKeyToAccount(generatePrivateKey()).address
    const id = certificateId(CHAIN_ID, CONTRACT, funder, 0n)
    const cert: Certificate = {
      id,
      funder,
      payee,
      spender: privateKeyToAccount(spenderKey).address,
      faceValue: 500_000n,
      redeemed: 0n,
      expiresAt: BigInt(Math.floor(Date.now() / 1000) + 4 * 86_400), // ≥ 3 days (§21.6)
      closed: false,
    }
    const h = buildHostedOracle({
      accepts: ['anvil'],
      payee,
      seller,
      env: {},
      hosted: true,
      cronSecret: 's',
      readCertificate: async (_c, _k, q) => (q.toLowerCase() === id.toLowerCase() ? { ...cert } : null),
    })
    const n = await signNote(privateKeyToAccount(spenderKey), CHAIN_ID, CONTRACT, {
      certificateId: id,
      cumulative: 5_000n,
      memo: newRequestId(),
    })
    const r = await h.app.request('http://oracle.test/v1/proverb', { headers: { [NOTE_HEADER]: encodeHeader(n) } })
    expect(r.status).toBe(200)
    const keys = await redis.keys(`${seller.prefix}s:${payee.toLowerCase()}:${CHAIN_ID}:${id.toLowerCase()}:*`)
    expect(keys.some((k: string) => k.endsWith(':state'))).toBe(true)
    await h.afterServe() // opportunistic sweep/redeem never throws, even without a redeemer
  })
})

describe('coalesce (opportunistic maintenance after serving)', () => {
  it('a burst during a run never drops the last check: exactly one more run follows, seeing the latest state', async () => {
    let state = 0
    const seen: number[] = []
    let release!: () => void
    let gate = new Promise<void>((r) => {
      release = r
    })
    const run = coalesce(async () => {
      await gate
      seen.push(state)
    })
    const first = run()
    for (let i = 1; i <= 4; i++) {
      state = i // requests keep arriving while the first check runs
      void run()
    }
    gate = Promise.resolve()
    release()
    await first
    await run.idle()
    expect(seen).toEqual([4, 4]) // the first run, then exactly one more, which saw the final state
  })

  it('a failing run is reported, never thrown (it runs after the response)', async () => {
    const errors: string[] = []
    const run = coalesce(
      async () => {
        throw new Error('rpc down')
      },
      (e) => errors.push(e.message),
    )
    await expect(run()).resolves.toBeUndefined()
    expect(errors).toEqual(['rpc down'])
  })
})
