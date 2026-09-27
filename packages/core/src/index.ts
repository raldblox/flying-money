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
  stringToBytes,
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
  return recoverDigestSigner(hashNote(signed.chainId, signed.contract, signed), signed.sig)
}

/** Pure ECDSA recovery of an EIP-712 digest with the same strict rules as notes (v ∈ {27, 28}, low-s, r/s in range). */
function recoverDigestSigner(digestHex: Hex, sig: Hex): Hex | null {
  try {
    if (!/^0x[0-9a-fA-F]{130}$/.test(sig)) return null
    const r = BigInt(`0x${sig.slice(2, 66)}`)
    const s = BigInt(`0x${sig.slice(66, 130)}`)
    const v = Number.parseInt(sig.slice(130, 132), 16)
    if (v !== 27 && v !== 28) return null
    if (r === 0n || s === 0n || r >= secp256k1.CURVE.n || s > HALF_N) return null
    const pub = new secp256k1.Signature(r, s).addRecoveryBit(v - 27).recoverPublicKey(digestHex.slice(2))
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

/** Counter payments (§6.8 step 2): memo = requestId = keccak256(orderId), so a re-scan is idempotent per order. */
export function counterRequestId(orderId: string): Hex {
  return keccak256(stringToBytes(orderId))
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

function unwrap(header: string, maxBytes = MAX_HEADER_BYTES): Record<string, unknown> {
  if (typeof header !== 'string') throw new Error('fm1: header must be a string')
  if (header.length > maxBytes) throw new Error(`fm1: exceeds ${maxBytes / 1024} KB`)
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

// ───────── spending requests (§21.4): off-chain objects that never move money (R1) ─────────

/** A budget request signed by the agent's own spending key (§21.4.1). */
export interface SpendRequest {
  /** the spending key that will receive the budget; it signs this request */
  requester: Hex
  /** who is asked (the funder) */
  owner: Hex
  /** the service or place */
  payee: Hex
  /** USDC base units */
  amount: bigint
  /** requested lifetime in seconds (≥ 1 day) */
  validFor: bigint
  /** 0x0 = a new certificate; otherwise a top-up of this certificate */
  certificateId: Hex
  requestId: Hex
  /** unix seconds */
  createdAt: bigint
  /** untrusted display text, ≤ 280 characters (R4) */
  reason: string
  /** untrusted display text, e.g. the service URL (R4) */
  origin: string
}

export interface SignedSpendRequest {
  request: SpendRequest
  chainId: number
  sig: Hex
}

export const REQUEST_MIN_VALID_FOR = 86_400n
export const REQUEST_MAX_REASON = 280
export const REQUEST_MAX_ORIGIN = 200
/** Links and relay payloads: at most 4 KB (§21.4.2). */
export const MAX_REQUEST_BYTES = 4096
export const ZERO_ID: Hex = `0x${'0'.repeat(64)}`

export const requestTypes = {
  SpendRequest: [
    { name: 'requester', type: 'address' },
    { name: 'owner', type: 'address' },
    { name: 'payee', type: 'address' },
    { name: 'amount', type: 'uint256' },
    { name: 'validFor', type: 'uint64' },
    { name: 'certificateId', type: 'bytes32' },
    { name: 'requestId', type: 'bytes32' },
    { name: 'createdAt', type: 'uint64' },
    { name: 'reason', type: 'string' },
    { name: 'origin', type: 'string' },
  ],
} as const

/**
 * The request domain (§21.4.1): no verifyingContract and a different name from the Note domain, so no request
 * signature can ever be a valid Note.
 */
export function requestDomain(chainId: number): TypedDataDomain & { chainId: number } {
  return { name: 'FlyingMoneyRequest', version: '1', chainId }
}

const requestMessage = (r: SpendRequest) => ({
  requester: r.requester,
  owner: r.owner,
  payee: r.payee,
  amount: r.amount,
  validFor: r.validFor,
  certificateId: r.certificateId,
  requestId: r.requestId,
  createdAt: r.createdAt,
  reason: r.reason,
  origin: r.origin,
})

export function hashSpendRequest(chainId: number, r: SpendRequest): Hex {
  return hashTypedData({
    domain: requestDomain(chainId),
    types: requestTypes,
    primaryType: 'SpendRequest',
    message: requestMessage(r),
  })
}

function checkRequest(r: SpendRequest): void {
  if (r.amount <= 0n) throw new Error('request: amount must be positive')
  if (r.validFor < REQUEST_MIN_VALID_FOR) throw new Error('request: validFor must be at least one day')
  if (r.validFor >= 2n ** 64n || r.createdAt >= 2n ** 64n) throw new Error('request: uint64 overflow')
  if ([...r.reason].length > REQUEST_MAX_REASON)
    throw new Error(`request: reason is over ${REQUEST_MAX_REASON} characters`)
  if ([...r.origin].length > REQUEST_MAX_ORIGIN)
    throw new Error(`request: origin is over ${REQUEST_MAX_ORIGIN} characters`)
  if (r.requester.toLowerCase() === r.owner.toLowerCase()) throw new Error('request: the owner cannot be the requester')
  if (r.requester.toLowerCase() === r.payee.toLowerCase()) throw new Error('request: the payee cannot be the requester')
}

/** Signs a budget request with the agent's own spending key (a LocalAccount: the key never leaves the agent). */
export async function signSpendRequest(
  account: LocalAccount,
  chainId: number,
  request: Omit<SpendRequest, 'requester'>,
): Promise<SignedSpendRequest> {
  const r: SpendRequest = { ...request, requester: account.address }
  checkRequest(r)
  const sig = await account.signTypedData({
    domain: requestDomain(chainId),
    types: requestTypes,
    primaryType: 'SpendRequest',
    message: requestMessage(r),
  })
  return { request: r, chainId, sig }
}

/** True only if the requester itself signed exactly this request on this chain (pure ECDSA, offline). */
export function verifySpendRequest(s: SignedSpendRequest): boolean {
  const who = recoverDigestSigner(hashSpendRequest(s.chainId, s.request), s.sig)
  return who !== null && who.toLowerCase() === s.request.requester.toLowerCase()
}

/** 'fm1.' + base64url(JSON), for links and QR codes (§21.4.1). */
export function encodeSpendRequest(s: SignedSpendRequest): string {
  const r = s.request
  return wrap({
    v: 1,
    type: 'SpendRequest',
    chainId: String(s.chainId),
    request: {
      requester: r.requester,
      owner: r.owner,
      payee: r.payee,
      amount: r.amount.toString(),
      validFor: r.validFor.toString(),
      certificateId: r.certificateId,
      requestId: r.requestId,
      createdAt: r.createdAt.toString(),
      reason: r.reason,
      origin: r.origin,
    },
    sig: s.sig,
  })
}

/** Strict parser (§8.1 rules). It does not check the signature: call verifySpendRequest. */
export function decodeSpendRequest(value: string): SignedSpendRequest {
  const o = unwrap(value, MAX_REQUEST_BYTES)
  exactKeys(o, ['v', 'type', 'chainId', 'request', 'sig'])
  if (o.v !== 1) throw new Error('fm1: v must be 1')
  if (o.type !== 'SpendRequest') throw new Error('fm1: not a SpendRequest')
  if (typeof o.request !== 'object' || o.request === null || Array.isArray(o.request))
    throw new Error('fm1: bad request')
  const q = o.request as Record<string, unknown>
  exactKeys(q, [
    'requester',
    'owner',
    'payee',
    'amount',
    'validFor',
    'certificateId',
    'requestId',
    'createdAt',
    'reason',
    'origin',
  ])
  const text = (v: unknown, field: string) => {
    if (typeof v !== 'string') throw new Error(`fm1: ${field} must be a string`)
    return v
  }
  const request: SpendRequest = {
    requester: hexN(q.requester, 20, 'requester'),
    owner: hexN(q.owner, 20, 'owner'),
    payee: hexN(q.payee, 20, 'payee'),
    amount: uint(q.amount, 'amount'),
    validFor: uint(q.validFor, 'validFor'),
    certificateId: hexN(q.certificateId, 32, 'certificateId'),
    requestId: hexN(q.requestId, 32, 'requestId'),
    createdAt: uint(q.createdAt, 'createdAt'),
    reason: text(q.reason, 'reason'),
    origin: text(q.origin, 'origin'),
  }
  checkRequest(request)
  return { request, chainId: chainIdOf(o.chainId), sig: hexN(o.sig, 65, 'sig') }
}

/** The relay's body parts (§21.4.2: `{ request, sig }` in wire form) → a strictly parsed signed request. */
export function spendRequestFromParts(chainId: unknown, request: unknown, sig: unknown): SignedSpendRequest {
  return decodeSpendRequest(wrap({ v: 1, type: 'SpendRequest', chainId, request, sig }))
}

/** A signed request in wire form (the relay's body and storage). */
export function spendRequestToParts(s: SignedSpendRequest) {
  const o = JSON.parse(fromB64url(encodeSpendRequest(s).slice(HEADER_PREFIX.length))) as {
    chainId: string
    request: Record<string, string>
    sig: Hex
  }
  return { chainId: o.chainId, request: o.request, sig: o.sig }
}

// ───────── request grants (§21.4.1): the owner's "I accept budget requests from this key" ─────────

export interface RequestGrant {
  owner: Hex
  /** the agent's spending key allowed to ask */
  requester: Hex
  /** USDC base units */
  maxAmountPerRequest: bigint
  /** unix seconds */
  expiresAt: bigint
  grantId: Hex
}

export interface SignedRequestGrant {
  grant: RequestGrant
  chainId: number
  sig: Hex
}

export const grantTypes = {
  RequestGrant: [
    { name: 'owner', type: 'address' },
    { name: 'requester', type: 'address' },
    { name: 'maxAmountPerRequest', type: 'uint256' },
    { name: 'expiresAt', type: 'uint64' },
    { name: 'grantId', type: 'bytes32' },
  ],
} as const

/** What the owner's wallet signs (eth_signTypedData_v4), in the request domain. */
export function grantTypedData(chainId: number, g: RequestGrant) {
  return {
    domain: requestDomain(chainId),
    types: grantTypes,
    primaryType: 'RequestGrant' as const,
    message: {
      owner: g.owner,
      requester: g.requester,
      maxAmountPerRequest: g.maxAmountPerRequest,
      expiresAt: g.expiresAt,
      grantId: g.grantId,
    },
  }
}

function checkGrant(g: RequestGrant): void {
  if (g.maxAmountPerRequest <= 0n) throw new Error('grant: maxAmountPerRequest must be positive')
  if (g.expiresAt >= 2n ** 64n) throw new Error('grant: uint64 overflow')
  if (g.owner.toLowerCase() === g.requester.toLowerCase()) throw new Error('grant: the owner cannot be the requester')
}

/** True only if the owner itself signed exactly this grant on this chain. */
export function verifyRequestGrant(s: SignedRequestGrant): boolean {
  try {
    checkGrant(s.grant)
  } catch {
    return false
  }
  const who = recoverDigestSigner(hashTypedData(grantTypedData(s.chainId, s.grant)), s.sig)
  return who !== null && who.toLowerCase() === s.grant.owner.toLowerCase()
}

export function encodeRequestGrant(s: SignedRequestGrant): string {
  const g = s.grant
  return wrap({
    v: 1,
    type: 'RequestGrant',
    chainId: String(s.chainId),
    grant: {
      owner: g.owner,
      requester: g.requester,
      maxAmountPerRequest: g.maxAmountPerRequest.toString(),
      expiresAt: g.expiresAt.toString(),
      grantId: g.grantId,
    },
    sig: s.sig,
  })
}

/** Strict parser. It does not check the signature: call verifyRequestGrant. */
export function decodeRequestGrant(value: string): SignedRequestGrant {
  const o = unwrap(value, MAX_REQUEST_BYTES)
  exactKeys(o, ['v', 'type', 'chainId', 'grant', 'sig'])
  if (o.v !== 1) throw new Error('fm1: v must be 1')
  if (o.type !== 'RequestGrant') throw new Error('fm1: not a RequestGrant')
  if (typeof o.grant !== 'object' || o.grant === null || Array.isArray(o.grant)) throw new Error('fm1: bad grant')
  const q = o.grant as Record<string, unknown>
  exactKeys(q, ['owner', 'requester', 'maxAmountPerRequest', 'expiresAt', 'grantId'])
  const grant: RequestGrant = {
    owner: hexN(q.owner, 20, 'owner'),
    requester: hexN(q.requester, 20, 'requester'),
    maxAmountPerRequest: uint(q.maxAmountPerRequest, 'maxAmountPerRequest'),
    expiresAt: uint(q.expiresAt, 'expiresAt'),
    grantId: hexN(q.grantId, 32, 'grantId'),
  }
  checkGrant(grant)
  return { grant, chainId: chainIdOf(o.chainId), sig: hexN(o.sig, 65, 'sig') }
}

/** A signed grant in wire form (the relay's `{ grant, grantSig }`). */
export function requestGrantToParts(s: SignedRequestGrant) {
  const o = JSON.parse(fromB64url(encodeRequestGrant(s).slice(HEADER_PREFIX.length))) as {
    chainId: string
    grant: Record<string, string>
    sig: Hex
  }
  return { chainId: o.chainId, grant: o.grant, sig: o.sig }
}

/** The relay's body parts (`{ grant, grantSig }`) → a strictly parsed signed grant. */
export function requestGrantFromParts(chainId: unknown, grant: unknown, sig: unknown): SignedRequestGrant {
  return decodeRequestGrant(wrap({ v: 1, type: 'RequestGrant', chainId, grant, sig }))
}

// ───────── inbox access (§21.4.2): the owner proves it is the owner to read its requests ─────────

export const inboxAccessTypes = {
  InboxAccess: [
    { name: 'owner', type: 'address' },
    { name: 'issuedAt', type: 'uint64' },
  ],
} as const

export function inboxAccessTypedData(chainId: number, owner: Hex, issuedAt: bigint) {
  return {
    domain: requestDomain(chainId),
    types: inboxAccessTypes,
    primaryType: 'InboxAccess' as const,
    message: { owner, issuedAt },
  }
}

export function verifyInboxAccess(chainId: number, owner: Hex, issuedAt: bigint, sig: Hex): boolean {
  if (issuedAt >= 2n ** 64n) return false
  const who = recoverDigestSigner(hashTypedData(inboxAccessTypedData(chainId, owner, issuedAt)), sig)
  return who !== null && who.toLowerCase() === owner.toLowerCase()
}
