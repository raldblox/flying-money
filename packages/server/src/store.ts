import type { CertKey, Hex, SignedNote } from '@flying-money/core'

export type { CertKey }

export type SellerStatus = 'OK' | 'RECOVERED'
export type OutcomeStatus = 'PENDING' | 'SERVED' | 'FAILED_CREDITED'

export interface SellerState {
  accepted: bigint
  consumed: bigint
  reserved: bigint
  status: SellerStatus
}

export interface Outcome {
  status: OutcomeStatus
  price: bigint
  responseRef?: string
  /** Hash of the request the requestId was admitted for (D32). Absent when begin was called without one. */
  requestHash?: Hex
}

export interface Submission {
  txHash: Hex
  keys: CertKey[]
  /** Account nonce of the batch tx, used to detect a dropped/replaced tx without ever rebroadcasting (D14). */
  nonce?: number
}

export interface PendingRedemption {
  key: CertKey
  note: SignedNote
  redeemedOnChain: bigint
  /** ms timestamp of the oldest served-but-unredeemed value (D6). */
  oldestServedAt?: number
}

/**
 * Seller store (BUILD_SPEC §8.3). `begin` and `finish` MUST each be a single atomic transaction.
 * This is authoritative application state: implementations MUST be durable and backed up (§6.5).
 */
export interface NoteStore {
  state(key: CertKey): Promise<SellerState | null>
  /** Highest stored note with cumulative ≤ maxCumulative. */
  bestNote(key: CertKey, maxCumulative: bigint): Promise<SignedNote | null>
  outcome(key: CertKey, requestId: Hex): Promise<Outcome | null>
  /** Atomic §6.5 step 7: re-checks S2 inside the transaction; reserved += price. */
  begin(
    key: CertKey,
    requestId: Hex,
    price: bigint,
    note: SignedNote,
    faceValue: bigint,
    /** Binds the requestId to one request (D32); stored with the outcome in the same transaction. */
    requestHash?: Hex,
  ): Promise<'ADMITTED' | 'DUPLICATE' | 'INSUFFICIENT'>
  /** Atomic §6.5 step 9; valid only from PENDING. */
  finish(key: CertKey, requestId: Hex, ok: boolean, responseRef?: string): Promise<'DONE' | 'NOT_PENDING'>
  stalePending(olderThanMs: number): Promise<Array<{ key: CertKey; requestId: Hex }>>
  /** §6.5 Recovery: only initialises a missing state (never overwrites). Status per DECISIONS D5. */
  recover(key: CertKey, redeemedOnChain: bigint): Promise<void>
  markRedeemed(key: CertKey, cumulative: bigint, txHash: Hex): Promise<void>
  pendingRedemptions(chainId: number): Promise<PendingRedemption[]>
  getSubmission(chainId: number): Promise<Submission | null>
  setSubmission(chainId: number, s: Submission | null): Promise<void>
}

export class NoStateError extends Error {
  constructor(key: CertKey) {
    super(`no seller state for ${key}; call recover() first`)
  }
}

export const normKey = (key: CertKey): CertKey => key.toLowerCase() as CertKey
export const normId = (id: Hex): Hex => id.toLowerCase() as Hex
export const chainOfKey = (key: CertKey): number => Number(key.split(':')[0])
