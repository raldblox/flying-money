import { isAddress } from 'viem'

/**
 * Shop onboarding helpers (BUILD_SPEC §22.10 e). A shop's "get a budget for this shop" link opens the gift form with
 * the shop as the seller. Anyone can make such a link, so a seller read from one is always unverified (§22.3, D37);
 * scanning the counter QR in person is what checks it.
 */
export function budgetLinkForShop(base: string, chain: string, payee: string, name: string): string {
  const q = new URLSearchParams({ for: 'person', chain, seller: payee, name: name.trim() })
  return `${base.replace(/\/$/, '')}/app/give?${q.toString()}`
}

export function sellerFromLink(
  q: URLSearchParams,
): { address: `0x${string}`; name: string; verified: false } | undefined {
  const seller = q.get('seller')?.trim()
  if (!seller || !isAddress(seller)) return undefined
  const name = (q.get('name') ?? '').trim().slice(0, 60) || 'A shop from a link'
  return { address: seller as `0x${string}`, name, verified: false }
}

export interface SavedTill {
  chain: string
  payee: string
  name: string
  at?: number
}
const KEY = 'fm-tills'
const same = (a: SavedTill, chain: string, payee: string) =>
  a.chain === chain && a.payee.toLowerCase() === payee.toLowerCase()

/** The tills opened on this device (only here: nothing about a shop is stored on a server). */
export function listTills(): SavedTill[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '[]') as unknown
    return Array.isArray(v)
      ? v.filter(
          (t): t is SavedTill =>
            typeof t?.chain === 'string' && isAddress(t?.payee ?? '') && typeof t?.name === 'string',
        )
      : []
  } catch {
    return []
  }
}

export function rememberTill(t: SavedTill): void {
  try {
    const rest = listTills().filter((x) => !same(x, t.chain, t.payee))
    localStorage.setItem(KEY, JSON.stringify([{ ...t, at: Date.now() }, ...rest].slice(0, 20)))
  } catch {}
}

export function forgetTill(chain: string, payee: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(listTills().filter((x) => !same(x, chain, payee))))
  } catch {}
}
