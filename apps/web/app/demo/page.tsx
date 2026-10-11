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
        Your agent. <em className="text-seal">Your approval.</em>
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-2">
        An AI agent wants to buy from a paid API. You approve a shopping list, we fund a small test budget, and you
        watch the agent pay with signed slips it can never exceed. No wallet needed.
      </p>
      <DemoClient chains={demoChains} defaultChain={chain.key} />
    </div>
  )
}
