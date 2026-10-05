import { getChainById } from '@flying-money/chains'
import { decodeNote, decodeOffer, type Hex, type Offer, type SignedNote } from '@flying-money/core'
import {
  bytesToHex,
  compactSignatureToSignature,
  getAddress,
  hexToBytes,
  parseCompactSignature,
  parseSignature,
  serializeCompactSignature,
  serializeSignature,
  signatureToCompactSignature,
} from 'viem'

/**
 * Compact text forms of a payment slip (note) and a price code (offer), for carriers with little room: sound (140
 * bytes a message), NFC tags, dense QR codes. They decode to exactly the same signed note and offer as the `fm1.`
 * header forms, so nothing about the payment changes: the contract address and token come from the registry by chain
 * id, the signature is EIP-2098 (64 bytes), and a till's slip may leave out the memo, which the till already knows
 * from its own order.
 *
 *   fm2n.<base64url>  note:  flags(1) chainId(4) certificateId(32) cumulative(8) [memo(32)] sig(64)
 *   fm2o.<base64url>  offer: flags(1) chainId(4) payee(20) price(8) minRemainingLifetime(4) hintLen(1) hint(utf8)
 */
export const NOTE_PREFIX = 'fm2n.'
export const OFFER_PREFIX = 'fm2o.'
const HAS_MEMO = 1
const U64_MAX = 2n ** 64n - 1n

const b64 = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const unb64 = (s: string) => {
  if (!/^[A-Za-z0-9_-]+$/.test(s)) throw new Error('not base64url')
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
const u32 = (n: number) => {
  const b = new Uint8Array(4)
  new DataView(b.buffer).setUint32(0, n)
  return b
}
const u64 = (n: bigint) => {
  const b = new Uint8Array(8)
  new DataView(b.buffer).setBigUint64(0, n)
  return b
}
const join = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((s, p) => s + p.length, 0))
  let i = 0
  for (const p of parts) {
    out.set(p, i)
    i += p.length
  }
  return out
}

function contractFor(chainId: number): Hex {
  const c = getChainById(chainId)
  if (!c?.flyingMoney) throw new Error(`no Flying Money deployment on chain ${chainId}`)
  return c.flyingMoney
}

/**
 * The compact form of a slip, or null when it can't be compacted (a contract other than the registry's, or an
 * amount past 64 bits): then use the `fm1.` form. `withMemo: false` only for a till that knows the memo itself.
 */
export function encodeNoteCompact(n: SignedNote, { withMemo = true } = {}): string | null {
  const c = getChainById(n.chainId)
  if (!c?.flyingMoney || c.flyingMoney.toLowerCase() !== n.contract.toLowerCase()) return null
  if (n.cumulative > U64_MAX) return null
  const sig = hexToBytes(serializeCompactSignature(signatureToCompactSignature(parseSignature(n.sig))))
  return (
    NOTE_PREFIX +
    b64(
      join(
        Uint8Array.of(withMemo ? HAS_MEMO : 0),
        u32(n.chainId),
        hexToBytes(n.certificateId),
        u64(n.cumulative),
        ...(withMemo ? [hexToBytes(n.memo)] : []),
        sig,
      ),
    )
  )
}

export function decodeNoteCompact(text: string, ctx: { memo?: Hex } = {}): SignedNote {
  if (!text.startsWith(NOTE_PREFIX)) throw new Error('not a compact slip')
  const b = unb64(text.slice(NOTE_PREFIX.length))
  const flags = b[0] ?? 0xff
  const hasMemo = (flags & HAS_MEMO) === HAS_MEMO
  if (flags & ~HAS_MEMO || b.length !== 1 + 4 + 32 + 8 + (hasMemo ? 32 : 0) + 64) throw new Error('bad compact slip')
  const dv = new DataView(b.buffer, b.byteOffset)
  const chainId = dv.getUint32(1)
  const certificateId = bytesToHex(b.slice(5, 37))
  const cumulative = dv.getBigUint64(37)
  let memo: Hex
  if (hasMemo) memo = bytesToHex(b.slice(45, 77))
  else if (ctx.memo) memo = ctx.memo
  else throw new Error('this slip leaves out its order: it can only be read by the till that asked for it')
  const at = hasMemo ? 77 : 45
  const sig = serializeSignature(compactSignatureToSignature(parseCompactSignature(bytesToHex(b.slice(at, at + 64)))))
  return { chainId, contract: contractFor(chainId), certificateId, cumulative, memo, sig }
}

export function encodeOfferCompact(o: Offer): string | null {
  const a = o.accepts[0]
  if (o.accepts.length !== 1 || !a) return null
  const c = getChainById(a.chainId)
  if (!c?.flyingMoney || c.flyingMoney.toLowerCase() !== a.contract.toLowerCase()) return null
  if (c.usdc.toLowerCase() !== a.token.toLowerCase() || o.price > U64_MAX) return null
  const hint = new TextEncoder().encode(o.memoHint ?? '')
  if (hint.length > 64 || o.suggestedFaceValue !== undefined || o.docs !== undefined) return null
  return (
    OFFER_PREFIX +
    b64(
      join(
        Uint8Array.of(0),
        u32(a.chainId),
        hexToBytes(a.payee),
        u64(o.price),
        u32(o.minRemainingLifetime),
        Uint8Array.of(hint.length),
        hint,
      ),
    )
  )
}

export function decodeOfferCompact(text: string): Offer {
  if (!text.startsWith(OFFER_PREFIX)) throw new Error('not a compact price code')
  const b = unb64(text.slice(OFFER_PREFIX.length))
  if (b[0] !== 0 || b.length < 38 || b.length !== 38 + b[37]!) throw new Error('bad compact price code')
  const dv = new DataView(b.buffer, b.byteOffset)
  const chainId = dv.getUint32(1)
  const c = getChainById(chainId)
  if (!c?.flyingMoney) throw new Error(`no Flying Money deployment on chain ${chainId}`)
  const hint = new TextDecoder().decode(b.slice(38))
  return {
    scheme: 'flying-money',
    v: 1,
    price: dv.getBigUint64(25),
    minRemainingLifetime: dv.getUint32(33),
    accepts: [{ chainId, contract: c.flyingMoney, token: c.usdc, payee: getAddress(bytesToHex(b.slice(5, 25))) }],
    ...(hint ? { memoHint: hint } : {}),
  }
}

export type Carried = { kind: 'note'; note: SignedNote } | { kind: 'offer'; offer: Offer }

/** Pulls the payload out of whatever arrived: a bare code, or a link that carries it after `#` or in `?c=`. */
export function payloadOf(text: string): string {
  const t = text.trim()
  try {
    const u = new URL(t)
    const fromHash = decodeURIComponent(u.hash.replace(/^#/, ''))
    if (fromHash) return fromHash
    const q = u.searchParams.get('c')
    if (q) return q
  } catch {
    // not a link
  }
  return t
}

/** Reads any slip or price code, in either form. `memo`: a till's own order, for slips that leave it out. */
export function decodeCarried(text: string, ctx: { memo?: Hex } = {}): Carried {
  const p = payloadOf(text)
  if (p.startsWith(NOTE_PREFIX)) return { kind: 'note', note: decodeNoteCompact(p, ctx) }
  if (p.startsWith(OFFER_PREFIX)) return { kind: 'offer', offer: decodeOfferCompact(p) }
  if (p.startsWith('fm1.')) {
    try {
      return { kind: 'note', note: decodeNote(p) }
    } catch {
      return { kind: 'offer', offer: decodeOffer(p) }
    }
  }
  throw new Error('That isn’t a Flying Money slip or price code.')
}

/** A link that opens the payload in this app on any device (the code rides after `#`, so it never reaches a server). */
export function carryLink(origin: string, payload: string): string {
  return `${origin.replace(/\/$/, '')}/carry#${payload}`
}
