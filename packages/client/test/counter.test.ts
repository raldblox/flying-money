import { counterRequestId, decodeNote, type Hex, newRequestId, type Offer } from '@flying-money/core'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import {
  abandonCounterPayment,
  type CounterCertificate,
  type CounterState,
  type CounterWalletStore,
  confirmCounterPayment,
  counterBalance,
  memoryCounterStore,
  prepareCounterPayment,
} from '../src/counter.js'
import { InsufficientBudgetError, NoCertificateError, PendingUnresolvedError } from '../src/index.js'

// Customer wallet at a counter (§6.6 with requestId = keccak256(orderId), §6.8 step 2, DECISIONS D20).
const CHAIN = 31337
const CONTRACT: Hex = '0x00000000000000000000000000000000000f1f1f'
const TOKEN: Hex = '0x00000000000000000000000000000000000c0c0c'
const SHOP: Hex = '0x000000000000000000000000000000000000beef'
const NOW = 1_800_000_000
const key = generatePrivateKey()
const spender = privateKeyToAccount(key)

const cert = (face = 20_000_000n): CounterCertificate => ({
  chainId: CHAIN,
  contract: CONTRACT,
  id: newRequestId(),
  payee: SHOP,
  faceValue: face,
  expiresAt: BigInt(NOW + 30 * 86_400),
})
const offer = (price: bigint, orderId: string, payee: Hex = SHOP): Offer => ({
  scheme: 'flying-money',
  v: 1,
  price,
  minRemainingLifetime: 3600,
  accepts: [{ chainId: CHAIN, contract: CONTRACT, token: TOKEN, payee }],
  memoHint: orderId,
})
const pay = (store: CounterWalletStore, c: CounterCertificate, o: Offer) =>
  prepareCounterPayment({ store, spender, certificate: c, offer: o, now: () => NOW })

describe('counter wallet (§6.6 at a counter)', () => {
  it('signs max(accepted, consumed + P) with memo = keccak256(orderId), saved before it is shown', async () => {
    const store = memoryCounterStore()
    const c = cert()
    const r = await pay(store, c, offer(3_500_000n, 'o1'))
    const n = decodeNote(r.noteQr)
    expect(n.cumulative).toBe(3_500_000n)
    expect(n.memo).toBe(counterRequestId('o1'))
    expect(r.reused).toBe(false)
    const s = (await store.load(c)) as CounterState
    expect(s.pending?.noteQr).toBe(r.noteQr)
  })

  it('until the shop accepts, the SAME QR is shown again; a different order is refused', async () => {
    const store = memoryCounterStore()
    const c = cert()
    const a = await pay(store, c, offer(3_500_000n, 'o1'))
    const b = await pay(store, c, offer(3_500_000n, 'o1'))
    expect(b).toMatchObject({ noteQr: a.noteQr, reused: true })
    await expect(pay(store, c, offer(1_000_000n, 'o2'))).rejects.toBeInstanceOf(PendingUnresolvedError)
  })

  it('Done → the next order raises the total by its price; abandoning never raises it', async () => {
    const store = memoryCounterStore()
    const c = cert()
    await pay(store, c, offer(3_500_000n, 'o1'))
    await confirmCounterPayment(store, c)
    const b = decodeNote((await pay(store, c, offer(2_000_000n, 'o2'))).noteQr)
    expect(b.cumulative).toBe(5_500_000n)
    await abandonCounterPayment(store, c) // "the shop didn't accept it"
    const again = decodeNote((await pay(store, c, offer(2_000_000n, 'o3'))).noteQr)
    expect(again.cumulative).toBe(5_500_000n) // same total, never higher
    expect(counterBalance(c, (await store.load(c)) as CounterState)).toBe(14_500_000n)
  })

  it('refuses over face value, the wrong shop, a short lifetime', async () => {
    const store = memoryCounterStore()
    const c = cert(3_000_000n)
    await expect(pay(store, c, offer(3_500_000n, 'x'))).rejects.toBeInstanceOf(InsufficientBudgetError)
    await expect(pay(store, c, offer(1n, 'y', '0x000000000000000000000000000000000000dead'))).rejects.toBeInstanceOf(
      NoCertificateError,
    )
    const short = { ...c, expiresAt: BigInt(NOW + 600) }
    await expect(pay(store, short, offer(1n, 'z'))).rejects.toBeInstanceOf(NoCertificateError)
    expect(await store.load(c)).toBeNull() // nothing was signed or saved
  })

  it('C1 (randomised, 1,000 steps with crashes): a total only grows by the price of a new order', async () => {
    const saved = new Map<string, string>()
    const durable = (): CounterWalletStore => memoryCounterStore(saved) // re-opened after each "crash"
    const c = cert(1_000_000_000n)
    let store = durable()
    let highest = 0n
    let acceptedByShop = 0n
    for (let i = 0; i < 1000; i++) {
      const roll = Math.random()
      if (roll < 0.15) {
        store = durable() // crash + restart: memory gone, durable state kept
        continue
      }
      const s = await store.load(c)
      if (s?.pending && roll < 0.55) {
        if (Math.random() < 0.6) {
          acceptedByShop += s.pending.price
          await confirmCounterPayment(store, c)
        } else await abandonCounterPayment(store, c)
        continue
      }
      const orderId = s?.pending ? s.pending.orderId : `order-${i}`
      const price = s?.pending ? s.pending.price : BigInt(1 + Math.floor(Math.random() * 5)) * 100_000n
      const r = await pay(store, c, offer(price, orderId))
      const cum = decodeNote(r.noteQr).cumulative
      if (r.reused) expect(r.noteQr).toBe(s?.pending?.noteQr)
      // C1: never above what was already signed, except by exactly this new order's price over accepted orders
      else expect(cum).toBeLessThanOrEqual(highest > acceptedByShop + price ? highest : acceptedByShop + price)
      expect(cum).toBeLessThanOrEqual(c.faceValue)
      if (cum > highest) highest = cum
    }
  })
})
