import { certKey, counterRequestId, encodeHeader, type Hex, signNote } from '@flying-money/core'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { beforeEach, describe, expect, it } from 'vitest'
import { type CounterKV, createCounter, memoryKV } from '../src/counter.js'
import { memoryStore, type StoreSnapshot } from '../src/index.js'
import { CHAIN_ID, Clock, CONTRACT, FakeChain, payee } from './fixtures.js'

// §6.8 counter transport + acceptance statuses, §12.5 POS. Money in 6-decimal USDC units.
const USDC = 1_000_000n
const DAY = 86_400n

async function sealed(spenderKey: Hex, id: Hex, cumulative: bigint, orderId: string) {
  const n = await signNote(privateKeyToAccount(spenderKey), CHAIN_ID, CONTRACT, {
    certificateId: id,
    cumulative,
    memo: counterRequestId(orderId),
  })
  return encodeHeader(n)
}

describe('counter (shop till) §6.8', () => {
  let chain: FakeChain
  let clock: Clock
  let kv: CounterKV
  let saved: StoreSnapshot | undefined
  const spender = generatePrivateKey()
  const spenderAddr = privateKeyToAccount(spender).address

  const till = (firstVisitLimit = 5n * USDC) =>
    createCounter({
      chain: 'anvil',
      payee: payee.address,
      store: memoryStore({
        ...(saved ? { initial: structuredClone(saved) } : {}),
        onCommit: async (s) => {
          saved = s
        },
      }),
      kv,
      firstVisitLimit,
      readCertificate: chain.reader,
      now: clock.now,
    })

  beforeEach(() => {
    chain = new FakeChain()
    clock = new Clock()
    kv = memoryKV()
    saved = undefined
  })

  const issue = (face = 20n * USDC, over: Partial<{ payee: Hex; expiresAt: bigint }> = {}) =>
    chain.issue({ faceValue: face, expiresAt: BigInt(clock.t) + 30n * DAY, spender: spenderAddr, ...over })

  it('price QR is an fm1 offer with a single accepts entry and the order id as memoHint', () => {
    const t = till()
    const qr = t.priceQr(3_500_000n, 'order-1')
    expect(qr.startsWith('fm1.')).toBe(true)
    const o = t.decodePrice(qr)
    expect(o.price).toBe(3_500_000n)
    expect(o.accepts).toHaveLength(1)
    expect(o.accepts[0]!.payee.toLowerCase()).toBe(payee.address.toLowerCase())
    expect(o.memoHint).toBe('order-1')
  })

  it('online: GUARANTEED with remaining; a re-scan returns the same outcome and charges nothing twice', async () => {
    const t = till()
    const c = issue()
    const qr = await sealed(spender, c.id, 3_500_000n, 'o1')
    const r = await t.accept(qr, 3_500_000n, 'o1')
    expect(r).toMatchObject({ status: 'GUARANTEED', replay: false, remaining: 16_500_000n })
    const again = await t.accept(qr, 3_500_000n, 'o1')
    expect(again).toMatchObject({ status: 'GUARANTEED', replay: true, remaining: 16_500_000n })
    const st = await t.store.state(certKey(CHAIN_ID, c.id))
    expect(st).toMatchObject({ accepted: 3_500_000n, consumed: 3_500_000n, reserved: 0n })
  })

  it('a sealed note made for another order is REJECTED (an old QR cannot pay for a new order)', async () => {
    const t = till()
    const c = issue()
    const qr = await sealed(spender, c.id, 3_500_000n, 'o1')
    expect((await t.accept(qr, 3_500_000n, 'o1')).status).toBe('GUARANTEED')
    const r = await t.accept(qr, 3_500_000n, 'o2')
    expect(r).toMatchObject({ status: 'REJECTED', reason: 'different-order' })
  })

  it('REJECTED: wrong shop, not enough left, expired, bad signature, unknown certificate, garbage', async () => {
    const t = till()
    const other = privateKeyToAccount(generatePrivateKey()).address
    const wrong = issue(20n * USDC, { payee: other })
    expect((await t.accept(await sealed(spender, wrong.id, USDC, 'a'), USDC, 'a')).reason).toBe('wrong-payee')

    const small = issue(2n * USDC)
    expect((await t.accept(await sealed(spender, small.id, 3n * USDC, 'b'), 3n * USDC, 'b')).reason).toBe(
      'insufficient',
    )

    const old = issue(20n * USDC, { expiresAt: BigInt(clock.t) + 60n })
    expect((await t.accept(await sealed(spender, old.id, USDC, 'c'), USDC, 'c')).reason).toBe('expiring')

    const c = issue()
    const forged = await sealed(generatePrivateKey(), c.id, USDC, 'd')
    expect((await t.accept(forged, USDC, 'd')).reason).toBe('bad-signature')

    const ghost = `0x${'ab'.repeat(32)}` as Hex
    expect((await t.accept(await sealed(spender, ghost, USDC, 'e'), USDC, 'e')).reason).toBe('unknown-certificate')

    expect((await t.accept('fm1.not-a-note', USDC, 'f')).reason).toBe('malformed')
    for (const x of ['a', 'b', 'c', 'd', 'e', 'f']) expect((await t.accept('fm1.x', USDC, x)).status).toBe('REJECTED')
  })

  it('offline, certificate seen before: still GUARANTEED (cached), also after the till restarts', async () => {
    const c = issue()
    let t = till()
    expect((await t.accept(await sealed(spender, c.id, 3n * USDC, 'o1'), 3n * USDC, 'o1')).status).toBe('GUARANTEED')
    chain.down = true
    expect((await t.accept(await sealed(spender, c.id, 6n * USDC, 'o2'), 3n * USDC, 'o2')).status).toBe('GUARANTEED')
    t = till() // restart: in-memory caches gone, only the durable store + kv remain
    const r = await t.accept(await sealed(spender, c.id, 9n * USDC, 'o3'), 3n * USDC, 'o3')
    expect(r).toMatchObject({ status: 'GUARANTEED', remaining: 11n * USDC })
    // and the S2 budget still holds offline: a note that does not cover the price is refused
    const low = await t.accept(await sealed(spender, c.id, 9n * USDC, 'o4'), USDC, 'o4')
    expect(low).toMatchObject({ status: 'REJECTED', reason: 'insufficient' })
  })

  it('offline, never-seen certificate: UNVERIFIED up to the first-visit limit, never GUARANTEED', async () => {
    const c = issue()
    chain.down = true
    const t = till(5n * USDC)
    const qr = await sealed(spender, c.id, 3n * USDC, 'o1')
    const r = await t.accept(qr, 3n * USDC, 'o1')
    expect(r).toMatchObject({ status: 'UNVERIFIED', riskLimit: 5n * USDC, replay: false })
    expect(await t.accept(qr, 3n * USDC, 'o1')).toMatchObject({ status: 'UNVERIFIED', replay: true })
    // the unverified total per certificate is capped by the first-visit limit
    const over = await t.accept(await sealed(spender, c.id, 6n * USDC, 'o2'), 3n * USDC, 'o2')
    expect(over).toMatchObject({ status: 'REJECTED', reason: 'over-first-visit-limit' })
    // nothing unverified ever enters the guaranteed ledger
    expect(await t.store.state(certKey(CHAIN_ID, c.id))).toBeNull()
    expect(await t.unverified()).toHaveLength(1)
  })

  it('reconnect: genuine UNVERIFIED notes are promoted to GUARANTEED; fabricated ones are flagged', async () => {
    const c = issue()
    const ghost = `0x${'cd'.repeat(32)}` as Hex
    chain.down = true
    let t = till(5n * USDC)
    await t.accept(await sealed(spender, c.id, 2n * USDC, 'g1'), 2n * USDC, 'g1')
    await t.accept(await sealed(spender, ghost, 2n * USDC, 'f1'), 2n * USDC, 'f1')
    const imposter = issue()
    await t.accept(await sealed(generatePrivateKey(), imposter.id, USDC, 'f2'), USDC, 'f2')
    t = till(5n * USDC) // survives a restart
    expect(await t.reconcile()).toEqual({ promoted: 0, flagged: 0, waiting: 3 })
    chain.down = false
    expect(await t.reconcile()).toEqual({ promoted: 1, flagged: 2, waiting: 0 })
    const list = await t.unverified()
    expect(list.map((u) => u.state).sort()).toEqual(['FLAGGED', 'FLAGGED', 'PROMOTED'])
    // a re-scan of the promoted note is now a GUARANTEED replay
    const again = await t.accept(await sealed(spender, c.id, 2n * USDC, 'g1'), 2n * USDC, 'g1')
    expect(again).toMatchObject({ status: 'GUARANTEED', replay: true })
    expect(await t.store.state(certKey(CHAIN_ID, c.id))).toMatchObject({ accepted: 2n * USDC, consumed: 2n * USDC })
  })

  it('S2 at the counter (randomised): GUARANTEED totals never exceed the best note or the face value', async () => {
    const c = issue(10n * USDC)
    const t = till()
    let signedMax = 0n
    let guaranteed = 0n
    for (let i = 0; i < 60; i++) {
      chain.down = Math.random() < 0.3
      const price = BigInt(1 + Math.floor(Math.random() * 3)) * 500_000n
      // an adversarial wallet: sometimes signs too little, sometimes re-uses old totals, sometimes over face value
      const cum = BigInt(Math.floor(Math.random() * 12)) * 1_000_000n
      if (cum > signedMax && cum <= c.faceValue) signedMax = cum
      const r = await t.accept(await sealed(spender, c.id, cum, `r${i}`), price, `r${i}`)
      if (r.status === 'GUARANTEED' && !r.replay) guaranteed += price
      expect(guaranteed).toBeLessThanOrEqual(signedMax)
      expect(guaranteed).toBeLessThanOrEqual(c.faceValue)
    }
    const st = await t.store.state(certKey(CHAIN_ID, c.id))
    if (st) expect(st.consumed).toBe(guaranteed)
  })
})
