import { getChain, isChainKey } from '@flying-money/chains'
import type { Metadata } from 'next'
import { SilkRoadMap } from '@/components/art/silk-road-map'
import { SITE } from '@/lib/site'
import { DemoClient } from './demo-client'

export const metadata: Metadata = {
  title: 'Live demo',
  description: 'An AI agent buys data from a paid API with sealed notes, live on a testnet. Real transactions only.',
}

export default function DemoPage() {
  const key = process.env.NEXT_PUBLIC_DEFAULT_CHAIN ?? 'arbitrum-sepolia'
  const chain = getChain(isChainKey(key) ? key : 'arbitrum-sepolia')
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-seal">Live demo · {SITE.testnetMode}</p>
      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
            Watch an agent <em className="text-seal">pay</em>.
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-ink-2">
            The Merchant, an AI agent planning a tea trade, buys data from the Silk Road Oracle. Its budget is a sealed
            certificate for that one seller: it pays each request with a signed note the seller checks instantly, and
            the seller redeems everything in a few on-chain transactions. Tea prices and routes are fictional game data;
            the weather is real.
          </p>
        </div>
        <SilkRoadMap className="hidden w-full lg:block" />
      </div>
      <DemoClient chainName={chain.chain.name} />
    </div>
  )
}
