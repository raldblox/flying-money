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
import type { Hex, Offer, SignedNote } from './index.js'

/**
 * Carrying a slip anywhere (protocol.md, "Carriers"). A slip (note) and a price code (offer) have compact text forms
 * that decode to exactly the same signed objects as their `fm1.` header forms, so every carrier ends in the same
 * seller checks. Small carriers (sound, Bluetooth, LoRa, NFC, MQTT, a ROS 2 message) move them as numbered frames.
 *
 *   fm2n.<base64url>  note:  flags(1) chainId(4) certificateId(32) cumulative(8) [memo(32)] sig(64, EIP-2098)
 *   fm2o.<base64url>  offer: flags(1) chainId(4) payee(20) price(8) minRemainingLifetime(4) hintLen(1) hint(utf8)
 *   frame             "<i>/<n>:<part>"  1 ≤ i ≤ n ≤ 99, parts joined in order of i
 *
 * The contract and token are not carried: both sides look them up by chain id (`CarryContext`). A till's slip may
 * leave out the memo, which the till derives from its own order.
 */
export const NOTE_COMPACT_PREFIX = 'fm2n.'
export const OFFER_COMPACT_PREFIX = 'fm2o.'
const HAS_MEMO = 1
const U64_MAX = 2n ** 64n - 1n

/** Where the contract and the settlement token live on a chain (the registry: `@flying-money/chains`). */
export type CarryContext = (chainId: number) => { contract: Hex; token: Hex } | undefined

const b64 = (b: Uint8Array) => {
  let s = ''
  for (const x of b) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
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
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase()

/** The compact slip, or null when compacting would change it (another contract, an amount past 64 bits). */
export function encodeNoteCompact(n: SignedNote, ctx: CarryContext, { withMemo = true } = {}): string | null {
  const d = ctx(n.chainId)
  if (!d || !same(d.contract, n.contract) || n.cumulative > U64_MAX) return null
  const sig = hexToBytes(serializeCompactSignature(signatureToCompactSignature(parseSignature(n.sig))))
  return (
    NOTE_COMPACT_PREFIX +
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

export function decodeNoteCompact(text: string, ctx: CarryContext, opts: { memo?: Hex } = {}): SignedNote {
  if (!text.startsWith(NOTE_COMPACT_PREFIX)) throw new Error('not a compact slip')
  const b = unb64(text.slice(NOTE_COMPACT_PREFIX.length))
  const flags = b[0] ?? 0xff
  const hasMemo = (flags & HAS_MEMO) === HAS_MEMO
  if (flags & ~HAS_MEMO || b.length !== 1 + 4 + 32 + 8 + (hasMemo ? 32 : 0) + 64) throw new Error('bad compact slip')
  const dv = new DataView(b.buffer, b.byteOffset)
  const chainId = dv.getUint32(1)
  const d = ctx(chainId)
  if (!d) throw new Error(`no Flying Money deployment on chain ${chainId}`)
  let memo: Hex
  if (hasMemo) memo = bytesToHex(b.slice(45, 77))
  else if (opts.memo) memo = opts.memo
  else throw new Error('this slip leaves out its order: it can only be read by the till that asked for it')
  const at = hasMemo ? 77 : 45
  return {
    chainId,
    contract: d.contract,
    certificateId: bytesToHex(b.slice(5, 37)),
    cumulative: dv.getBigUint64(37),
    memo,
    sig: serializeSignature(compactSignatureToSignature(parseCompactSignature(bytesToHex(b.slice(at, at + 64))))),
  }
}

/** The compact price code, or null when it can't carry the offer exactly (several networks, extra fields). */
export function encodeOfferCompact(o: Offer, ctx: CarryContext): string | null {
  const a = o.accepts[0]
  if (o.accepts.length !== 1 || !a) return null
  const d = ctx(a.chainId)
  if (!d || !same(d.contract, a.contract) || !same(d.token, a.token) || o.price > U64_MAX) return null
  const hint = new TextEncoder().encode(o.memoHint ?? '')
  if (hint.length > 64 || o.suggestedFaceValue !== undefined || o.docs !== undefined) return null
  return (
    OFFER_COMPACT_PREFIX +
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

export function decodeOfferCompact(text: string, ctx: CarryContext): Offer {
  if (!text.startsWith(OFFER_COMPACT_PREFIX)) throw new Error('not a compact price code')
  const b = unb64(text.slice(OFFER_COMPACT_PREFIX.length))
  if (b[0] !== 0 || b.length < 38 || b.length !== 38 + (b[37] ?? 0)) throw new Error('bad compact price code')
  const dv = new DataView(b.buffer, b.byteOffset)
  const chainId = dv.getUint32(1)
  const d = ctx(chainId)
  if (!d) throw new Error(`no Flying Money deployment on chain ${chainId}`)
  const hint = new TextDecoder().decode(b.slice(38))
  return {
    scheme: 'flying-money',
    v: 1,
    price: dv.getBigUint64(25),
    minRemainingLifetime: dv.getUint32(33),
    accepts: [{ chainId, contract: d.contract, token: d.token, payee: getAddress(bytesToHex(b.slice(5, 25))) }],
    ...(hint ? { memoHint: hint } : {}),
  }
}

/** Splits a payload into numbered frames of at most `max` characters each (a sound chirp, a BLE write, a LoRa packet). */
export function toFrames(text: string, max: number): string[] {
  const room = max - 6 // "99/99:"
  if (room < 1) throw new Error('frames need at least 7 characters')
  const n = Math.max(1, Math.ceil(text.length / room))
  if (n > 99) throw new Error('too long for frames')
  return Array.from({ length: n }, (_, i) => `${i + 1}/${n}:${text.slice(i * room, (i + 1) * room)}`)
}

/** Collects frames in any order (repeats are fine) and returns the whole payload once every part has arrived. */
export function frameCollector() {
  let total = 0
  const parts = new Map<number, string>()
  return (frame: string): { got: number; total: number; text?: string } | null => {
    const m = /^(\d{1,2})\/(\d{1,2}):([\s\S]*)$/.exec(frame)
    if (!m) return null
    const i = Number(m[1])
    const n = Number(m[2])
    if (n < 1 || i < 1 || i > n) return null
    if (n !== total) {
      total = n
      parts.clear()
    }
    parts.set(i, m[3]!)
    if (parts.size < total) return { got: parts.size, total }
    const text = Array.from({ length: total }, (_, k) => parts.get(k + 1)).join('')
    parts.clear()
    return { got: total, total, text }
  }
}
