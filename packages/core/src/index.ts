import { flyingMoneyAbi } from '@flying-money/abi'
import { secp256k1 } from '@noble/curves/secp256k1'
import {
  bytesToHex,
  encodeAbiParameters,
  getAddress,
  type Hex,
  hashTypedData,
  keccak256,
  type LocalAccount,
  type PublicClient,
  type TypedDataDomain,
  type WalletClient,
} from 'viem'

/**
 * @flying-money/core — types, EIP-712, verification and wire encoding (BUILD_SPEC §6, §8.1).
 * Amounts are integer base units (bigint). Never floats.
 */

export type { Hex }
export { flyingMoneyAbi }

export interface Certificate {
  id: Hex
  funder: Hex
  payee: Hex
  spender: Hex // token is per deployment (registry), not per certificate
  faceValue: bigint
  redeemed: bigint
  expiresAt: bigint
  closed: boolean
}
export interface Note {
  certificateId: Hex
  cumulative: bigint
  memo: Hex
}
export interface SignedNote extends Note {
  chainId: number
  contract: Hex
  sig: Hex
}
export interface Accept {
  chainId: number
  contract: Hex
  token: Hex
  payee: Hex
}
export interface Offer {
  scheme: 'flying-money'
  v: 1
  price: bigint
  minRemainingLifetime: number
  accepts: Accept[]
  suggestedFaceValue?: bigint
  memoHint?: string
  docs?: string
}
export type ReceiptStatus = 'SERVED' | 'FAILED_CREDITED'
export interface Receipt {
  certificateId: Hex
  requestId: Hex
  status: ReceiptStatus
  accepted: bigint
  consumed: bigint
  reserved: bigint
  credit: bigint
  remaining: bigint
  expiresAt: bigint
  sig?: Hex
}

/** Seller/client state key, chain-namespaced (§8.3). */
export type CertKey = `${number}:${Hex}`
export const certKey = (chainId: number, id: Hex): CertKey => `${chainId}:${id.toLowerCase() as Hex}`

export const NOTE_HEADER = 'Flying-Money-Note'
export const OFFER_HEADER = 'Flying-Money-Offer'
export const RECEIPT_HEADER = 'Flying-Money-Receipt'
export const HEADER_PREFIX = 'fm1.'
export const MAX_HEADER_BYTES = 2048
export const SPEC_VERSION = '1.4.1'

// ───────── EIP-712 (§6.3) ─────────

export const noteTypes = {
  Note: [
    { name: 'certificateId', type: 'bytes32' },
    { name: 'cumulative', type: 'uint256' },
    { name: 'memo', type: 'bytes32' },
  ],
} as const

export function domain(chainId: number, contract: Hex): TypedDataDomain & { chainId: number; verifyingContract: Hex } {
  return { name: 'FlyingMoney', version: '1', chainId, verifyingContract: contract }
}

/** id = keccak256(abi.encode(chainId, contract, funder, funderNonce)) (§6.2). */
export function certificateId(chainId: number, contract: Hex, funder: Hex, nonce: bigint): Hex {
  return keccak256(
    encodeAbiParameters(
      [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, { type: 'uint256' }],
      [BigInt(chainId), contract, funder, nonce],
    ),
  )
}

export function hashNote(chainId: number, contract: Hex, note: Note): Hex {
  return hashTypedData({
    domain: domain(chainId, contract),
    types: noteTypes,
    primaryType: 'Note',
    message: { certificateId: note.certificateId, cumulative: note.cumulative, memo: note.memo },
  })
}

export async function signNote(
  account: LocalAccount | WalletClient,
  chainId: number,
  contract: Hex,
  note: Note,
): Promise<SignedNote> {
  const typed = {
    domain: domain(chainId, contract),
    types: noteTypes,
    primaryType: 'Note' as const,
    message: { certificateId: note.certificateId, cumulative: note.cumulative, memo: note.memo },
  }
  let sig: Hex
  if ('type' in account && account.type === 'local') {
    sig = await (account as LocalAccount).signTypedData(typed)
  } else {
    const wallet = account as WalletClient
    if (!wallet.account) throw new Error('WalletClient has no account')
    sig = await wallet.signTypedData({ ...typed, account: wallet.account })
  }
  return { certificateId: note.certificateId, cumulative: note.cumulative, memo: note.memo, chainId, contract, sig }
}

const HALF_N = secp256k1.CURVE.n >> 1n

/**
 * Pure ECDSA recovery; no RPC, works offline (§6.3, §7.1 #6). Mirrors OpenZeppelin ECDSA.tryRecover:
 * 65-byte signature, v ∈ {27, 28}, low-s required, r/s in range. Never consults chain state.
 */
export function recoverNoteSigner(signed: SignedNote): Hex | null {
  try {
    if (!/^0x[0-9a-fA-F]{130}$/.test(signed.sig)) return null
    const r = BigInt(`0x${signed.sig.slice(2, 66)}`)
    const s = BigInt(`0x${signed.sig.slice(66, 130)}`)
    const v = Number.parseInt(signed.sig.slice(130, 132), 16)
    if (v !== 27 && v !== 28) return null
    if (r === 0n || s === 0n || r >= secp256k1.CURVE.n || s > HALF_N) return null
    const digest = hashNote(signed.chainId, signed.contract, signed).slice(2)
    const pub = new secp256k1.Signature(r, s).addRecoveryBit(v - 27).recoverPublicKey(digest)
    const uncompressed = pub.toRawBytes(false)
    return getAddress(`0x${keccak256(bytesToHex(uncompressed.slice(1))).slice(-40)}`)
  } catch {
    return null
  }
}

export function verifyNoteSignature(signed: SignedNote, spender: Hex): boolean {
  const who = recoverNoteSigner(signed)
  return who !== null && who.toLowerCase() === spender.toLowerCase()
}

export function newRequestId(): Hex {
  return bytesToHex(crypto.getRandomValues(new Uint8Array(32)))
}

// ───────── wire encoding (§6.4, §8.1, DECISIONS D4) ─────────

const UINT256_MAX = 2n ** 256n - 1n
const INT_RE = /^(0|[1-9][0-9]*)$/

function toB64url(s: string): string {
  const bytes = new TextEncoder().encode(s)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromB64url(s: string): string {
  if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error('fm1: invalid base64url')
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
}

const wrap = (json: unknown) => HEADER_PREFIX + toB64url(JSON.stringify(json))

function unwrap(header: string): Record<string, unknown> {
  if (typeof header !== 'string') throw new Error('fm1: header must be a string')
  if (header.length > MAX_HEADER_BYTES) throw new Error('fm1: header exceeds 2 KB')
  if (!header.startsWith(HEADER_PREFIX)) throw new Error('fm1: bad prefix')
  const parsed: unknown = JSON.parse(fromB64url(header.slice(HEADER_PREFIX.length)))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('fm1: not an object')
  return parsed as Record<string, unknown>
}

function exactKeys(o: Record<string, unknown>, required: string[], optional: string[] = []): void {
  for (const k of required) if (!(k in o)) throw new Error(`fm1: missing field ${k}`)
  for (const k of Object.keys(o))
    if (!required.includes(k) && !optional.includes(k)) throw new Error(`fm1: unknown field ${k}`)
}

function uint(v: unknown, field: string): bigint {
  if (typeof v !== 'string' || !INT_RE.test(v)) throw new Error(`fm1: ${field} must be a decimal string`)
  const n = BigInt(v)
  if (n > UINT256_MAX) throw new Error(`fm1: ${field} exceeds uint256`)
  return n
}

function chainIdOf(v: unknown): number {
  const n = uint(v, 'chainId')
  if (n === 0n || n > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('fm1: bad chainId')
  return Number(n)
}

function hexN(v: unknown, bytes: number, field: string): Hex {
  if (typeof v !== 'string' || !new RegExp(`^0x[0-9a-fA-F]{${bytes * 2}}$`).test(v))
    throw new Error(`fm1: ${field} must be ${bytes}-byte hex`)
  return v as Hex
}

function smallInt(v: unknown, field: string): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 0)
    throw new Error(`fm1: ${field} must be a non-negative integer`)
  return v
}

function isOffer(o: object): o is Offer {
  return 'scheme' in o
}
function isReceipt(o: object): o is Receipt {
  return 'status' in o && 'requestId' in o
}

function noteJson(n: SignedNote) {
  return {
    v: 1,
    chainId: String(n.chainId),
    contract: n.contract,
    certificateId: n.certificateId,
    cumulative: n.cumulative.toString(),
    memo: n.memo,
    sig: n.sig,
  }
}

export function offerJson(o: Offer) {
  return {
    scheme: 'flying-money',
    v: 1,
    price: o.price.toString(),
    minRemainingLifetime: o.minRemainingLifetime,
    ...(o.suggestedFaceValue !== undefined ? { suggestedFaceValue: o.suggestedFaceValue.toString() } : {}),
    accepts: o.accepts.map((a) => ({
      chainId: String(a.chainId),
      contract: a.contract,
      token: a.token,
      payee: a.payee,
    })),
    ...(o.memoHint !== undefined ? { memoHint: o.memoHint } : {}),
    ...(o.docs !== undefined ? { docs: o.docs } : {}),
  }
}

function receiptJson(r: Receipt) {
  return {
    certificateId: r.certificateId,
    requestId: r.requestId,
    status: r.status,
    accepted: r.accepted.toString(),
    consumed: r.consumed.toString(),
    reserved: r.reserved.toString(),
    credit: r.credit.toString(),
    remaining: r.remaining.toString(),
    expiresAt: r.expiresAt.toString(),
    ...(r.sig !== undefined ? { sig: r.sig } : {}),
  }
}

/** 'fm1.' + base64url(JSON), bigints as decimal strings (§8.1). */
export function encodeHeader(obj: SignedNote | Offer | Receipt): string {
  if (isOffer(obj)) return wrap(offerJson(obj))
  if (isReceipt(obj)) return wrap(receiptJson(obj))
  return wrap(noteJson(obj))
}

export function decodeNote(header: string): SignedNote {
  const o = unwrap(header)
  exactKeys(o, ['v', 'chainId', 'contract', 'certificateId', 'cumulative', 'memo', 'sig'])
  if (o.v !== 1) throw new Error('fm1: v must be 1')
  return {
    chainId: chainIdOf(o.chainId),
    contract: hexN(o.contract, 20, 'contract'),
    certificateId: hexN(o.certificateId, 32, 'certificateId'),
    cumulative: uint(o.cumulative, 'cumulative'),
    memo: hexN(o.memo, 32, 'memo'),
    sig: hexN(o.sig, 65, 'sig'),
  }
}

/** Parses an offer object (from the 402 body or a decoded header). */
export function parseOffer(o: Record<string, unknown>): Offer {
  exactKeys(o, ['scheme', 'v', 'price', 'minRemainingLifetime', 'accepts'], ['suggestedFaceValue', 'memoHint', 'docs'])
  if (o.scheme !== 'flying-money') throw new Error('fm1: scheme must be flying-money')
  if (o.v !== 1) throw new Error('fm1: v must be 1')
  if (!Array.isArray(o.accepts) || o.accepts.length === 0) throw new Error('fm1: accepts must be a non-empty array')
  const accepts = o.accepts.map((a: unknown) => {
    if (typeof a !== 'object' || a === null || Array.isArray(a)) throw new Error('fm1: bad accepts entry')
    const e = a as Record<string, unknown>
    exactKeys(e, ['chainId', 'contract', 'token', 'payee'])
    return {
      chainId: chainIdOf(e.chainId),
      contract: hexN(e.contract, 20, 'contract'),
      token: hexN(e.token, 20, 'token'),
      payee: hexN(e.payee, 20, 'payee'),
    }
  })
  const offer: Offer = {
    scheme: 'flying-money',
    v: 1,
    price: uint(o.price, 'price'),
    minRemainingLifetime: smallInt(o.minRemainingLifetime, 'minRemainingLifetime'),
    accepts,
  }
  if (o.suggestedFaceValue !== undefined) offer.suggestedFaceValue = uint(o.suggestedFaceValue, 'suggestedFaceValue')
  if (o.memoHint !== undefined) {
    if (typeof o.memoHint !== 'string' || o.memoHint.length > 128) throw new Error('fm1: bad memoHint')
    offer.memoHint = o.memoHint
  }
  if (o.docs !== undefined) {
    if (typeof o.docs !== 'string' || o.docs.length > 512) throw new Error('fm1: bad docs')
    offer.docs = o.docs
  }
  return offer
}

export function decodeOffer(header: string): Offer {
  return parseOffer(unwrap(header))
}

export function decodeReceipt(header: string): Receipt {
  const o = unwrap(header)
  exactKeys(
    o,
    ['certificateId', 'requestId', 'status', 'accepted', 'consumed', 'reserved', 'credit', 'remaining', 'expiresAt'],
    ['sig'],
  )
  if (o.status !== 'SERVED' && o.status !== 'FAILED_CREDITED') throw new Error('fm1: bad status')
  const r: Receipt = {
    certificateId: hexN(o.certificateId, 32, 'certificateId'),
    requestId: hexN(o.requestId, 32, 'requestId'),
    status: o.status,
    accepted: uint(o.accepted, 'accepted'),
    consumed: uint(o.consumed, 'consumed'),
    reserved: uint(o.reserved, 'reserved'),
    credit: uint(o.credit, 'credit'),
    remaining: uint(o.remaining, 'remaining'),
    expiresAt: uint(o.expiresAt, 'expiresAt'),
  }
  if (o.sig !== undefined) r.sig = hexN(o.sig, 65, 'sig')
  return r
}

// ───────── chain reads ─────────

/** Read one certificate from the chain. Returns null if unknown (funder == 0). */
export async function readCertificate(client: PublicClient, contract: Hex, id: Hex): Promise<Certificate | null> {
  const c = await client.readContract({
    address: contract,
    abi: flyingMoneyAbi,
    functionName: 'getCertificate',
    args: [id],
  })
  if (/^0x0{40}$/i.test(c.funder)) return null
  return {
    id,
    funder: c.funder,
    payee: c.payee,
    spender: c.spender,
    faceValue: c.faceValue,
    redeemed: c.redeemed,
    expiresAt: c.expiresAt,
    closed: c.closed,
  }
}

export const sameAddress = (a: Hex, b: Hex) => a.toLowerCase() === b.toLowerCase()
export const maxBig = (a: bigint, b: bigint) => (a > b ? a : b)
