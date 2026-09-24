import type { Metadata } from 'next'
import { ButtonLink } from '@/components/section'
import { Lifecycle } from './lifecycle'

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Issue, seal, serve, redeem, reclaim: the life of a Flying Money certificate, in plain words or in detail.',
}

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
      <p className="smallcaps text-sm text-seal">How it works</p>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
        The life of a <em className="text-seal">certificate</em>.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-2">
        Two steps touch the blockchain (issue and redeem, plus reclaim at the end). Everything in between happens
        off-chain, in milliseconds. Switch to Technical to see the exact data at each step.
      </p>
      <div className="mt-10">
        <Lifecycle />
      </div>
      <div className="mt-12 flex flex-wrap gap-3">
        <ButtonLink href="/demo">Watch it live →</ButtonLink>
        <ButtonLink href="/docs/protocol" variant="secondary">
          Read the protocol
        </ButtonLink>
      </div>
    </div>
  )
}
