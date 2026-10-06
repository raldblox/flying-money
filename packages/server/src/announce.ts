import { DISCOVERY_SERVICE, type Hex, sellerTxt } from '@flying-money/core'
import { Bonjour } from 'bonjour-service'

/**
 * Announces a seller on the local network (mDNS / DNS-SD, `_flying-money._tcp`), so agents and devices on the same
 * Wi-Fi can find it with no internet and no registry (`discoverSellers` in `@flying-money/client/discover`).
 * Only announce on networks you trust to see it: the announcement is public to everyone on the link.
 */
export function announceSeller(o: {
  name: string
  port: number
  payee: Hex
  chainIds: number[]
  /** where the paid API lives on this host */
  path?: string
  wellKnown?: string
}): { stop(): Promise<void> } {
  const bonjour = new Bonjour()
  const service = bonjour.publish({
    name: o.name,
    type: DISCOVERY_SERVICE,
    port: o.port,
    txt: sellerTxt({
      path: o.path ?? '/',
      wellKnown: o.wellKnown ?? '/.well-known/flying-money.json',
      payee: o.payee,
      chainIds: o.chainIds,
    }),
  })
  return {
    stop: () =>
      new Promise<void>((done) => {
        const finish = () => bonjour.destroy(() => done())
        if (service.stop) service.stop(finish)
        else finish()
      }),
  }
}
