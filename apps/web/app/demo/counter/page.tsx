import { allChains } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import type { Metadata } from 'next'
import { InstallApp } from '@/components/install-app'
import { OfflineReady } from '@/components/offline-ready'
import { toPickerNetworks } from '@/lib/networks'
import { SITE } from '@/lib/site'
import { DemoCounter } from './demo-counter'

export const metadata: Metadata = {
  title: 'The offline counter',
  description:
    'Your phone pays a till with no internet: a slip by QR or sound, checked on the spot, guaranteed. The till collects when it’s back online.',
}
export const dynamic = 'force-dynamic'

export default function CounterDemoPage() {
  const chains = toPickerNetworks(allChains().filter((c) => !c.mainnet && c.flyingMoney && c.key !== 'anvil'))
  const payee = process.env.PAYEE_ADDRESS as Hex | undefined
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-14">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-seal">Demo · {SITE.testnetMode}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <OfflineReady />
        <InstallApp />
      </div>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
        The <em className="text-seal">offline</em> counter.
      </h1>
      <p className="mt-4 text-lg text-ink-2">
        This screen is a till. Your phone is the wallet. Give the phone a small budget for this till, switch it to
        airplane mode, and pay anyway: the slip travels by QR or sound, the till checks it on the spot, and the money is
        guaranteed, because it’s set aside for this till and can’t be pulled back. When the till is online again, it
        collects everything in one transaction.
      </p>
      {payee ? (
        <DemoCounter chains={chains} payee={payee} />
      ) : (
        <p className="sheet mt-8 p-6">The counter demo isn’t configured on this deployment.</p>
      )}
    </div>
  )
}
