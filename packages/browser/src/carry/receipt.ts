import type { Hex } from '@flying-money/core'

/**
 * The till's answer, carried back to the phone face to face: which payment it was for, whether the till took it,
 * and what was bought (for the demo, the 飛錢 certificate's details, so the phone draws it itself). It is an
 * acknowledgement, not money: a forged one can only make a wallet show a payment as accepted, never move funds.
 *
 *   fm2r.<base64url(JSON)>  { v: 1, m: memo prefix, c: budget prefix, p: price, s: 'G' | 'U', i?: item, k?: keepsake }
 */
export const RECEIPT_PREFIX = 'fm2r.'
const PREFIX_HEX = 18 // "0x" + 16 hex: enough to match the phone's own open payment

export interface TillReceipt {
  /** the slip's memo (the order), shortened */
  memo: string
  /** the budget it was paid from, shortened */
  certificate: string
  price: bigint
  /** GUARANTEED (a budget this till had checked) or UNVERIFIED (the shop's own risk) */
  status: 'GUARANTEED' | 'UNVERIFIED'
  item?: string
  keepsake?: { serial: string; name: string; issuedAt: string; proverb: number; chainId: number }
}

const b64 = (s: string) =>
  btoa(unescape(encodeURIComponent(s)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const unb64 = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))))

export function encodeReceipt(r: TillReceipt): string {
  return (
    RECEIPT_PREFIX +
    b64(
      JSON.stringify({
        v: 1,
        m: r.memo.slice(0, PREFIX_HEX).toLowerCase(),
        c: r.certificate.slice(0, PREFIX_HEX).toLowerCase(),
        p: r.price.toString(),
        s: r.status === 'GUARANTEED' ? 'G' : 'U',
        ...(r.item ? { i: r.item.slice(0, 40) } : {}),
        ...(r.keepsake
          ? {
              k: {
                s: r.keepsake.serial,
                n: r.keepsake.name.slice(0, 40),
                t: r.keepsake.issuedAt,
                q: r.keepsake.proverb,
                ch: r.keepsake.chainId,
              },
            }
          : {}),
      }),
    )
  )
}

export function decodeReceipt(text: string): TillReceipt | null {
  if (!text.startsWith(RECEIPT_PREFIX)) return null
  try {
    const j = JSON.parse(unb64(text.slice(RECEIPT_PREFIX.length))) as {
      v: number
      m: string
      c: string
      p: string
      s: 'G' | 'U'
      i?: string
      k?: { s: string; n: string; t: string; q: number; ch: number }
    }
    if (j.v !== 1 || !/^0x[0-9a-f]{16}$/.test(j.m) || !/^0x[0-9a-f]{16}$/.test(j.c) || !/^\d+$/.test(j.p)) return null
    return {
      memo: j.m,
      certificate: j.c,
      price: BigInt(j.p),
      status: j.s === 'G' ? 'GUARANTEED' : 'UNVERIFIED',
      ...(j.i ? { item: j.i } : {}),
      ...(j.k ? { keepsake: { serial: j.k.s, name: j.k.n, issuedAt: j.k.t, proverb: j.k.q, chainId: j.k.ch } } : {}),
    }
  } catch {
    return null
  }
}

/** True when the receipt answers this payment (the same order and budget). */
export function receiptFor(r: TillReceipt, memo: Hex, certificateId: Hex): boolean {
  return memo.toLowerCase().startsWith(r.memo) && certificateId.toLowerCase().startsWith(r.certificate)
}
