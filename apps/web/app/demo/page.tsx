import { allChains, getChain, isChainKey } from '@flying-money/chains'
import type { Metadata } from 'next'
import { toPickerNetworks } from '@/lib/networks'
import { SITE } from '@/lib/site'
import { DemoClient } from './demo-client'

export const metadata: Metadata = {
  title: 'Live demo',
  description:
    'An AI agent pays a data API per request from a capped budget, live on a test network. Real transactions only.',
}

export default function DemoPage() {
  const key = process.env.NEXT_PUBLIC_DEFAULT_CHAIN ?? 'arbitrum-sepolia'
  const chain = getChain(isChainKey(key) ? key : 'arbitrum-sepolia')
  // the runner only uses deployed testnets (§13.3); ?chain= picks among them (§21.2)
  const demoChains = toPickerNetworks(allChains().filter((c) => !c.mainnet && c.flyingMoney && c.key !== 'anvil'))
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-seal">Live demo · {SITE.testnetMode}</p>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
        Watch an agent <em className="text-seal">pay</em>.
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-2">
        An AI agent buys data from an API, one request at a time, from a budget it can’t go past. Below is how it plays
        out. Press <strong className="text-ink">Run it for real</strong> to do it on a test network with real
        transactions.
      </p>
      <section className="mt-8 grid gap-4 sm:grid-cols-2" aria-label="Other demos">
        <a href="/demo/counter" className="sheet block border-seal p-5 hover:border-seal">
          <p className="smallcaps text-xs text-seal">Play it · one screen, no setup</p>
          <p className="mt-1 font-display text-2xl font-semibold">The offline counter</p>
          <p className="mt-2 text-sm text-ink-2">
            A tea house you can play: fill a basket, pay, tip the staff, cut the till’s connection and keep paying, let
            a phone die halfway, play the thief. Real test money.
          </p>
        </a>
        <a href="/demo/slip" className="sheet block p-5 hover:border-seal">
          <p className="smallcaps text-xs text-seal">Two devices</p>
          <p className="mt-1 font-display text-2xl font-semibold">The slip that pays</p>
          <p className="mt-2 text-sm text-ink-2">
            Get a signed slip from our agent, carry it to another device by QR, sound, share, link or file, and spend it
            there for a 飛錢 certificate.
          </p>
        </a>
      </section>
      <DemoClient chains={demoChains} defaultChain={chain.key} />
    </div>
  )
}
