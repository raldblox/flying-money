import { carryContext } from '@flying-money/chains'
import {
  decodeNoteCompact as coreDecodeNote,
  decodeOfferCompact as coreDecodeOffer,
  encodeNoteCompact as coreEncodeNote,
  encodeOfferCompact as coreEncodeOffer,
  decodeNote,
  decodeOffer,
  type Hex,
  NOTE_COMPACT_PREFIX,
  OFFER_COMPACT_PREFIX,
  type Offer,
  type SignedNote,
} from '@flying-money/core'

/**
 * The site's side of carrying slips: core's compact forms (protocol.md, "Carriers") with the registry as the lookup
 * for contracts and tokens, plus reading whatever arrives (a bare code, a link, either form).
 */
export const NOTE_PREFIX = NOTE_COMPACT_PREFIX
export const OFFER_PREFIX = OFFER_COMPACT_PREFIX

export const encodeNoteCompact = (n: SignedNote, opts: { withMemo?: boolean } = {}) =>
  coreEncodeNote(n, carryContext, opts)
export const decodeNoteCompact = (text: string, ctx: { memo?: Hex } = {}) => coreDecodeNote(text, carryContext, ctx)
export const encodeOfferCompact = (o: Offer) => coreEncodeOffer(o, carryContext)
export const decodeOfferCompact = (text: string) => coreDecodeOffer(text, carryContext)

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
