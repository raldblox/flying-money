import {
  type CertKey,
  certKey,
  counterRequestId,
  encodeHeader,
  type Hex,
  maxBig,
  type Offer,
  sameAddress,
  signNote,
} from '@flying-money/core'
import type { LocalAccount } from 'viem'
import { InsufficientBudgetError, NoCertificateError, PendingUnresolvedError } from './client.js'

/**
 * Customer wallet at a counter (BUILD_SPEC §6.6 "the same algorithm … with requestId = orderId", §6.8 step 2).
 * The counter has no receipt channel back to the phone, so the final state comes from the customer, who sees the
 * till's result (DECISIONS D20): `confirm` after "Accepted", `abandon` only when the shop did not accept it.
 * Neither can make the spender sign a higher total for the same order (C1).
 */
export interface CounterCertificate {
  chainId: number
  contract: Hex
  id: Hex
  payee: Hex
  faceValue: bigint
  expiresAt: bigint
}

export interface CounterPending {
  orderId: string
  requestId: Hex
  noteQr: string
  cumulative: bigint
  price: bigint
  createdAt: number
}

/** Durable wallet state per certificate. `consumed` = Σ prices the customer saw accepted; `accepted` = best total. */
export interface CounterState {
  accepted: bigint
  consumed: bigint
  pending?: CounterPending
}

export interface CounterWalletStore {
  load(c: Pick<CounterCertificate, 'chainId' | 'id'>): Promise<CounterState | null>
  /** MUST be durable when it resolves (one atomic IndexedDB put in the browser). */
  save(c: Pick<CounterCertificate, 'chainId' | 'id'>, s: CounterState): Promise<void>
}

type Json = Record<string, unknown>
export function serializeCounterState(s: CounterState): Json {
  return {
    accepted: s.accepted.toString(),
    consumed: s.consumed.toString(),
    ...(s.pending
      ? { pending: { ...s.pending, cumulative: s.pending.cumulative.toString(), price: s.pending.price.toString() } }
      : {}),
  }
}
export function deserializeCounterState(j: Json): CounterState {
  const p = j.pending as Json | undefined
  return {
    accepted: BigInt(j.accepted as string),
    consumed: BigInt(j.consumed as string),
    ...(p
      ? {
          pending: {
            orderId: p.orderId as string,
            requestId: p.requestId as Hex,
            noteQr: p.noteQr as string,
            cumulative: BigInt(p.cumulative as string),
            price: BigInt(p.price as string),
            createdAt: p.createdAt as number,
          },
        }
      : {}),
  }
}

/** In-memory store; pass a Map to keep its contents across "restarts" (tests). */
export function memoryCounterStore(backing = new Map<string, string>()): CounterWalletStore {
  const k = (c: { chainId: number; id: Hex }): CertKey => certKey(c.chainId, c.id)
  return {
    async load(c) {
      const s = backing.get(k(c))
      return s ? deserializeCounterState(JSON.parse(s) as Json) : null
    },
    async save(c, s) {
      backing.set(k(c), JSON.stringify(serializeCounterState(s)))
    },
  }
}

/** Remaining on this device: face value minus the highest total this wallet has signed. */
export function counterBalance(c: CounterCertificate, s: CounterState | null): bigint {
  const used = s ? maxBig(maxBig(s.accepted, s.consumed), s.pending?.cumulative ?? 0n) : 0n
  return c.faceValue > used ? c.faceValue - used : 0n
}

/** Does this certificate pay the shop in this price QR (same chain, contract and payee)? */
export function certificateMatches(c: CounterCertificate, offer: Offer): boolean {
  return offer.accepts.some(
    (a) => a.chainId === c.chainId && sameAddress(a.contract, c.contract) && sameAddress(a.payee, c.payee),
  )
}

export async function prepareCounterPayment(opts: {
  store: CounterWalletStore
  spender: LocalAccount
  certificate: CounterCertificate
  offer: Offer
  now?: () => number
}): Promise<{ noteQr: string; cumulative: bigint; price: bigint; requestId: Hex; reused: boolean }> {
  const { store, certificate: c, offer } = opts
  const now = BigInt(Math.floor(opts.now ? opts.now() : Date.now() / 1000))
  const orderId = offer.memoHint
  if (!orderId) throw new Error('this price QR has no order id')
  const requestId = counterRequestId(orderId)
  const s = (await store.load(c)) ?? { accepted: 0n, consumed: 0n }

  // §6.6 step 2: an unresolved note is shown again, byte for byte; never re-signed higher
  if (s.pending) {
    if (s.pending.requestId.toLowerCase() === requestId.toLowerCase()) return { ...s.pending, reused: true }
    throw new PendingUnresolvedError(c.id)
  }
  if (!certificateMatches(c, offer)) throw new NoCertificateError(offer)
  if (c.expiresAt - now < BigInt(offer.minRemainingLifetime)) throw new NoCertificateError(offer)

  // §6.6 step 3
  const next = maxBig(s.accepted, s.consumed + offer.price)
  if (next > c.faceValue) throw new InsufficientBudgetError(c.id, next, c.faceValue)
  const note = await signNote(opts.spender, c.chainId, c.contract, {
    certificateId: c.id,
    cumulative: next,
    memo: requestId,
  })
  const pending: CounterPending = {
    orderId,
    requestId,
    noteQr: encodeHeader(note),
    cumulative: next,
    price: offer.price,
    createdAt: Date.now(),
  }
  await store.save(c, { ...s, pending }) // §6.6 step 4: durably saved BEFORE the QR is shown
  return { ...pending, reused: false }
}

/** The till showed "Accepted": the order reached its final state. */
export async function confirmCounterPayment(store: CounterWalletStore, c: CounterCertificate): Promise<void> {
  const s = await store.load(c)
  if (!s?.pending) return
  await store.save(c, {
    accepted: maxBig(s.accepted, s.pending.cumulative),
    consumed: s.consumed + s.pending.price,
  })
}

/**
 * The shop did not accept it (rejected, or the customer walked away). Clears the open order. The next order
 * re-signs from the same accepted/consumed values, so the total never grows past what was already signed plus
 * that new order's price.
 */
export async function abandonCounterPayment(store: CounterWalletStore, c: CounterCertificate): Promise<void> {
  const s = await store.load(c)
  if (!s?.pending) return
  await store.save(c, { accepted: s.accepted, consumed: s.consumed })
}
