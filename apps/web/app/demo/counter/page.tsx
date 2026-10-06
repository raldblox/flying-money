import { allChains } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import type { Metadata } from 'next'
import { InstallApp } from '@/components/install-app'
import { OfflineReady } from '@/components/offline-ready'
import { toPickerNetworks } from '@/lib/networks'
import { SITE } from '@/lib/site'
import { Store } from './store'

export const metadata: Metadata = {
  title: 'The offline counter',
  description:
    'A shop you can play: pick things off the shelf, pay with digital dollars, tip the staff, cut the till’s connection and keep paying. Real test transactions.',
}
export const dynamic = 'force-dynamic'

export default function CounterDemoPage() {
  const chains = toPickerNetworks(allChains().filter((c) => !c.mainnet && c.flyingMoney && c.key !== 'anvil'))
  const payee = process.env.PAYEE_ADDRESS as Hex | undefined
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-seal">Demo · {SITE.testnetMode}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <OfflineReady />
        <InstallApp />
      </div>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
        The <em className="text-seal">offline</em> counter.
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-2">
        A shop you can play, on one screen: the tea house’s till and your wallet, side by side. Pick something off the
        shelf, pay with digital dollars, tip the staff. Then cut the till’s connection and keep paying, let a phone die
        halfway, play the thief. Every payment is real (test money), and the till collects them all in one transaction.
      </p>
      <p className="mt-2 max-w-3xl text-sm text-ink-2">
        Want two devices? Move your money to your phone from the wallet side and pay the till from it.
      </p>
      {payee ? (
        <Store chains={chains} shopPayee={payee} staffPayee={SITE.demoStaff} />
      ) : (
        <p className="sheet mt-8 p-6">The counter demo isn’t configured on this deployment.</p>
      )}
    </div>
  )
}
