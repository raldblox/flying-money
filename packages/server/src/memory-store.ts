import type { Hex, SignedNote } from '@flying-money/core'
import {
  type CertKey,
  chainOfKey,
  NoStateError,
  type NoteStore,
  normId,
  normKey,
  type Outcome,
  type PendingRedemption,
  type SellerState,
  type Submission,
} from './store.js'

interface CertRow extends SellerState {
  redeemed: bigint
  oldestServedAt?: number
  /** Authentic notes indexed by cumulative (one per distinct cumulative). */
  notes: Map<bigint, SignedNote>
}

/**
 * In-memory NoteStore for tests and single-process demos. Every method body runs without an `await`
 * between its reads and writes, so each call is atomic under Node's single-threaded event loop.
 * NOT durable: use redisStore/upstashStore for real sellers (§6.5).
 */
export function memoryStore(): NoteStore {
  const certs = new Map<CertKey, CertRow>()
  const outcomes = new Map<string, Outcome & { admittedAt: number }>()
  const pending = new Map<string, { key: CertKey; requestId: Hex; at: number }>()
  const submissions = new Map<number, Submission>()
  const oid = (key: CertKey, rid: Hex) => `${normKey(key)}|${normId(rid)}`

  const best = (row: CertRow, max: bigint): SignedNote | null => {
    let found: SignedNote | null = null
    for (const [c, n] of row.notes) if (c <= max && (!found || c > found.cumulative)) found = n
    return found
  }

  return {
    async state(key) {
      const r = certs.get(normKey(key))
      return r ? { accepted: r.accepted, consumed: r.consumed, reserved: r.reserved, status: r.status } : null
    },
    async bestNote(key, max) {
      const r = certs.get(normKey(key))
      return r ? best(r, max) : null
    },
    async outcome(key, requestId) {
      const o = outcomes.get(oid(key, requestId))
      if (!o) return null
      return {
        status: o.status,
        price: o.price,
        ...(o.responseRef !== undefined ? { responseRef: o.responseRef } : {}),
      }
    },
    async begin(key, requestId, price, note, faceValue) {
      const k = normKey(key)
      const id = oid(k, requestId)
      if (outcomes.has(id)) return 'DUPLICATE'
      const r = certs.get(k)
      if (!r) throw new NoStateError(k)
      if (note.cumulative > faceValue) return 'INSUFFICIENT'
      const budget = note.cumulative > r.accepted ? note.cumulative : r.accepted
      if (r.consumed + r.reserved + price > budget) return 'INSUFFICIENT'
      const now = Date.now()
      outcomes.set(id, { status: 'PENDING', price, admittedAt: now })
      r.accepted = budget
      r.reserved += price
      if (!r.notes.has(note.cumulative)) r.notes.set(note.cumulative, note)
      pending.set(id, { key: k, requestId: normId(requestId), at: now })
      return 'ADMITTED'
    },
    async finish(key, requestId, ok, responseRef) {
      const k = normKey(key)
      const id = oid(k, requestId)
      const o = outcomes.get(id)
      const r = certs.get(k)
      if (o?.status !== 'PENDING' || !r) return 'NOT_PENDING'
      r.reserved -= o.price
      if (ok) {
        r.consumed += o.price
        if (r.oldestServedAt === undefined) r.oldestServedAt = Date.now()
        o.status = 'SERVED'
        if (responseRef !== undefined) o.responseRef = responseRef
      } else {
        o.status = 'FAILED_CREDITED'
      }
      pending.delete(id)
      return 'DONE'
    },
    async stalePending(olderThanMs) {
      const cutoff = Date.now() - olderThanMs
      return [...pending.values()].filter((p) => p.at <= cutoff).map(({ key, requestId }) => ({ key, requestId }))
    },
    async recover(key, redeemedOnChain) {
      const k = normKey(key)
      if (certs.has(k)) return
      certs.set(k, {
        accepted: redeemedOnChain,
        consumed: redeemedOnChain,
        reserved: 0n,
        status: redeemedOnChain > 0n ? 'RECOVERED' : 'OK',
        redeemed: redeemedOnChain,
        notes: new Map(),
      })
    },
    async markRedeemed(key, cumulative) {
      const r = certs.get(normKey(key))
      if (!r) return
      if (cumulative > r.redeemed) r.redeemed = cumulative
      for (const c of r.notes.keys()) if (c < r.redeemed) r.notes.delete(c)
      if (r.redeemed >= r.consumed) r.oldestServedAt = undefined
    },
    async pendingRedemptions(chainId) {
      const out: PendingRedemption[] = []
      for (const [key, r] of certs) {
        if (chainOfKey(key) !== chainId) continue
        const n = best(r, r.consumed)
        if (n && n.cumulative > r.redeemed)
          out.push({
            key,
            note: n,
            redeemedOnChain: r.redeemed,
            ...(r.oldestServedAt !== undefined ? { oldestServedAt: r.oldestServedAt } : {}),
          })
      }
      return out
    },
    async getSubmission(chainId) {
      const s = submissions.get(chainId)
      return s ? { ...s, keys: [...s.keys] } : null
    },
    async setSubmission(chainId, s) {
      if (s) submissions.set(chainId, { ...s, keys: [...s.keys] })
      else submissions.delete(chainId)
    },
  }
}
