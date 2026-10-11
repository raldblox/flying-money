import { allChains } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import type { Metadata } from 'next'
import { InstallApp } from '@/components/install-app'
import { OfflineReady } from '@/components/offline-ready'
import { E2E, e2eMode } from '@/lib/e2e'
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
  const chains = toPickerNetworks(
    allChains().filter((c) => !c.mainnet && c.flyingMoney && (e2eMode ? c.key === 'anvil' : c.key !== 'anvil')),
  )
  const payee = (e2eMode ? E2E.account : process.env.PAYEE_ADDRESS) as Hex | undefined
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
        Shop at a tea house with money we set aside for you. Then cut the till’s internet and keep paying: it still
        accepts your payments, and collects later. No wallet app, no gas.
      </p>

      {payee ? (
        <Store chains={chains} shopPayee={payee} staffPayee={SITE.demoStaff} />
      ) : (
        <div className="sheet mt-8 p-6">
          <p>The sponsored counter is unavailable right now.</p>
          <a className="mt-3 inline-block underline" href="/demo">
            Try the agent demo instead
          </a>
        </div>
      )}
    </div>
  )
}
