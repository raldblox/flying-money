import { DISCOVERY_SERVICE, type Hex, parseSellerTxt } from '@flying-money/core'
import { Bonjour } from 'bonjour-service'

export interface FoundSeller {
  name: string
  /** the paid API's base URL on the local network */
  url: string
  /** the seller's well-known description */
  wellKnownUrl: string
  host: string
  port: number
  payee: Hex
  chainIds: number[]
}

/**
 * Lists Flying Money sellers announcing themselves on the local network (mDNS / DNS-SD, `_flying-money._tcp`), for
 * `seconds` seconds. Works with no internet. An announcement is a claim, not a proof: check the seller's offer before
 * paying, and pay only from a budget made for that seller.
 */
export function discoverSellers({ seconds = 3 }: { seconds?: number } = {}): Promise<FoundSeller[]> {
  const bonjour = new Bonjour()
  const found = new Map<string, FoundSeller>()
  return new Promise((resolve) => {
    const browser = bonjour.find({ type: DISCOVERY_SERVICE }, (s) => {
      const a = parseSellerTxt(s.txt as Record<string, unknown>)
      const host = s.addresses?.find((x) => /^\d+\.\d+\.\d+\.\d+$/.test(x)) ?? s.addresses?.[0] ?? s.host
      if (!a || !host) return
      const base = `http://${host.includes(':') ? `[${host}]` : host}:${s.port}`
      found.set(`${host}:${s.port}`, {
        name: s.name,
        url: `${base}${a.path === '/' ? '' : a.path}`,
        wellKnownUrl: `${base}${a.wellKnown}`,
        host,
        port: s.port,
        payee: a.payee,
        chainIds: a.chainIds,
      })
    })
    setTimeout(() => {
      browser.stop()
      bonjour.destroy(() => resolve([...found.values()]))
    }, Math.max(1, seconds) * 1000)
  })
}
