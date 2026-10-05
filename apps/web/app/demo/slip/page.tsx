import { allChains } from '@flying-money/chains'
import type { Metadata } from 'next'
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
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-14">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-seal">Demo · {SITE.testnetMode}</p>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
        The slip that <em className="text-seal">pays</em>.
      </h1>
      <p className="mt-4 text-lg text-ink-2">
        A payment in Flying Money is a slip: a few hundred bytes, signed by an agent’s key, good at one seller, up to a
        budget its owner set aside. It doesn’t need the internet to travel. Get one from our agent, carry it to another
        device any way you like, and spend it there.
      </p>
      <SlipDemo chains={chains} />
    </div>
  )
}
