import { allChains } from '@flying-money/chains'
import type { Metadata } from 'next'
import { InstallApp } from '@/components/install-app'
import { OfflineReady } from '@/components/offline-ready'
import { toPickerNetworks } from '@/lib/networks'
import { SITE } from '@/lib/site'
import { SlipDemo } from './slip-demo'

export const metadata: Metadata = {
  title: 'The slip that pays',
  description:
    'An agent signs a payment slip and hands it to you. Carry it to any device by QR, sound, share, link or file, and spend it there. Real test-network transactions.',
}

export default function SlipDemoPage() {
  const chains = toPickerNetworks(allChains().filter((c) => !c.mainnet && c.flyingMoney && c.key !== 'anvil'))
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-seal">Demo · {SITE.testnetMode}</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <OfflineReady />
        <InstallApp />
      </div>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
        The slip that <em className="text-seal">pays</em>.
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-2">
        A payment in Flying Money is a slip: a few hundred bytes, signed, good at one seller, up to a budget that is
        already set aside. Get one from an agent and spend it right here. Or carry it to another device first.
      </p>
      <SlipDemo chains={chains} />
    </div>
  )
}
