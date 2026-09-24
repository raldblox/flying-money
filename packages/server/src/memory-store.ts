import { decodeNote, encodeHeader, type Hex, type SignedNote } from '@flying-money/core'
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

/** JSON-safe image of a memory store (bigints as decimal strings, notes in the strict fm1 wire format). */
export interface StoreSnapshot {
  v: 1
  certs: Array<
    [
      CertKey,
      {
        accepted: string
        consumed: string
        reserved: string
        status: SellerState['status']
        redeemed: string
        oldestServedAt?: number
        notes: string[]
      },
    ]
  >
  outcomes: Array<
    [string, { status: Outcome['status']; price: string; responseRef?: string; requestHash?: Hex; admittedAt: number }]
  >
  pending: Array<[string, { key: CertKey; requestId: Hex; at: number }]>
  submissions: Array<[number, { txHash: Hex; keys: CertKey[]; nonce?: number }]>
}

export interface MemoryStoreOptions {
  /** Start from a saved snapshot (e.g. loaded from IndexedDB). */
  initial?: StoreSnapshot
  /**
   * Called after every write with the new snapshot; the write's promise resolves only after it resolves.
   * With a durable `onCommit` (one atomic put), nothing is acknowledged before it is saved (§6.5).
   */
  onCommit?: (snapshot: StoreSnapshot) => Promise<void>
}

/**
 * In-memory NoteStore. Every method body runs without an `await` between its reads and writes, so each call is
 * atomic on a single-threaded event loop. NOT durable on its own: pass `onCommit` to persist every write (the
 * shop till does this with IndexedDB), or use redisStore/upstashStore for servers (§6.5).
 */
export function memoryStore(opts: MemoryStoreOptions = {}): NoteStore & { snapshot(): StoreSnapshot } {
  const certs = new Map<CertKey, CertRow>()
  const outcomes = new Map<string, Outcome & { admittedAt: number }>()
  const pending = new Map<string, { key: CertKey; requestId: Hex; at: number }>()
  const submissions = new Map<number, Submission>()
  if (opts.initial) restore(opts.initial)

  function restore(s: StoreSnapshot) {
    if (s.v !== 1) throw new Error('unknown store snapshot version')
    for (const [k, r] of s.certs) {
      const notes = new Map<bigint, SignedNote>()
      for (const h of r.notes) {
        const n = decodeNote(h)
        notes.set(n.cumulative, n)
      }
      certs.set(k, {
        accepted: BigInt(r.accepted),
        consumed: BigInt(r.consumed),
        reserved: BigInt(r.reserved),
        status: r.status,
        redeemed: BigInt(r.redeemed),
        ...(r.oldestServedAt !== undefined ? { oldestServedAt: r.oldestServedAt } : {}),
        notes,
      })
    }
    for (const [id, o] of s.outcomes)
      outcomes.set(id, {
        status: o.status,
        price: BigInt(o.price),
        admittedAt: o.admittedAt,
        ...(o.responseRef !== undefined ? { responseRef: o.responseRef } : {}),
        ...(o.requestHash !== undefined ? { requestHash: o.requestHash } : {}),
      })
    for (const [id, p] of s.pending) pending.set(id, { ...p })
    for (const [c, sub] of s.submissions) submissions.set(c, { ...sub, keys: [...sub.keys] })
  }

  function snapshot(): StoreSnapshot {
    return {
      v: 1,
      certs: [...certs].map(([k, r]) => [
        k,
        {
          accepted: r.accepted.toString(),
          consumed: r.consumed.toString(),
          reserved: r.reserved.toString(),
          status: r.status,
          redeemed: r.redeemed.toString(),
          ...(r.oldestServedAt !== undefined ? { oldestServedAt: r.oldestServedAt } : {}),
          notes: [...r.notes.values()].map((n) => encodeHeader(n)),
        },
      ]),
      outcomes: [...outcomes].map(([id, o]) => [
        id,
        {
          status: o.status,
          price: o.price.toString(),
          admittedAt: o.admittedAt,
          ...(o.responseRef !== undefined ? { responseRef: o.responseRef } : {}),
          ...(o.requestHash !== undefined ? { requestHash: o.requestHash } : {}),
        },
      ]),
      pending: [...pending].map(([id, p]) => [id, { ...p }]),
      submissions: [...submissions].map(([c, sub]) => [c, { ...sub, keys: [...sub.keys] }]),
    }
  }

  // take the snapshot synchronously (same tick as the write), then wait for it to be saved
  const commit = async <T>(result: T): Promise<T> => {
    if (opts.onCommit) await opts.onCommit(snapshot())
    return result
  }
  const oid = (key: CertKey, rid: Hex) => `${normKey(key)}|${normId(rid)}`

  const best = (row: CertRow, max: bigint): SignedNote | null => {
    let found: SignedNote | null = null
    for (const [c, n] of row.notes) if (c <= max && (!found || c > found.cumulative)) found = n
    return found
  }

  return {
    snapshot,
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
        ...(o.requestHash !== undefined ? { requestHash: o.requestHash } : {}),
      }
    },
    async begin(key, requestId, price, note, faceValue, requestHash) {
      const k = normKey(key)
      const id = oid(k, requestId)
      if (outcomes.has(id)) return 'DUPLICATE'
      const r = certs.get(k)
      if (!r) throw new NoStateError(k)
      if (note.cumulative > faceValue) return 'INSUFFICIENT'
      const budget = note.cumulative > r.accepted ? note.cumulative : r.accepted
      if (r.consumed + r.reserved + price > budget) return 'INSUFFICIENT'
      const now = Date.now()
      outcomes.set(id, {
        status: 'PENDING',
        price,
        admittedAt: now,
        ...(requestHash !== undefined ? { requestHash: requestHash.toLowerCase() as Hex } : {}),
      })
      r.accepted = budget
      r.reserved += price
      if (!r.notes.has(note.cumulative)) r.notes.set(note.cumulative, note)
      pending.set(id, { key: k, requestId: normId(requestId), at: now })
      return commit('ADMITTED' as const)
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
      return commit('DONE' as const)
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
      return commit(undefined)
    },
    async markRedeemed(key, cumulative) {
      const r = certs.get(normKey(key))
      if (!r) return
      if (cumulative > r.redeemed) r.redeemed = cumulative
      for (const c of r.notes.keys()) if (c < r.redeemed) r.notes.delete(c)
      if (r.redeemed >= r.consumed) r.oldestServedAt = undefined
      return commit(undefined)
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
      return commit(undefined)
    },
  }
}
