import type { Hex } from './index.js'

/**
 * Finding sellers on a local network (protocol.md, "Carriers"): DNS-SD over mDNS, the way a phone finds a printer,
 * with no internet and no registry. Same two stages as the IETF agent-discovery draft (draft-jakab-dawn-agent-
 * discovery-mdns): a small TXT descriptor here, the full description fetched from the seller's well-known file.
 *
 *   service  _flying-money._tcp
 *   TXT      v=1  path=/v1  wk=/.well-known/flying-money.json  payee=0x…  chains=421614,84532
 */
export const DISCOVERY_SERVICE = 'flying-money'

export interface SellerAnnouncement {
  v: 1
  /** where the paid API lives on this host ("/" for the root) */
  path: string
  /** the seller's well-known description (prices, accepted networks, headers) */
  wellKnown: string
  payee: Hex
  chainIds: number[]
}

export function sellerTxt(a: Omit<SellerAnnouncement, 'v'>): Record<string, string> {
  return { v: '1', path: a.path, wk: a.wellKnown, payee: a.payee, chains: a.chainIds.join(',') }
}

/** Reads a TXT record; null if it isn't a Flying Money seller (or is malformed). Values are untrusted until checked. */
export function parseSellerTxt(txt: Record<string, unknown> | undefined): SellerAnnouncement | null {
  if (!txt) return null
  const s = (k: string) => {
    const v = txt[k]
    return typeof v === 'string' ? v : v instanceof Uint8Array ? new TextDecoder().decode(v) : undefined
  }
  if (s('v') !== '1') return null
  const payee = s('payee')
  const path = s('path') ?? '/'
  const wellKnown = s('wk') ?? '/.well-known/flying-money.json'
  const chainIds = (s('chains') ?? '')
    .split(',')
    .map((c) => Number(c))
    .filter((n) => Number.isSafeInteger(n) && n > 0)
  if (!payee || !/^0x[0-9a-fA-F]{40}$/.test(payee) || !path.startsWith('/') || !wellKnown.startsWith('/')) return null
  return { v: 1, path, wellKnown, payee: payee as Hex, chainIds }
}
