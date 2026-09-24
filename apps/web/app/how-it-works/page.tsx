import type { Metadata } from 'next'
import { ButtonLink } from '@/components/section'
import { Lifecycle } from './lifecycle'

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Lock, sign, check, collect, take back leftovers: the life of a Flying Money budget, in pictures, plain words or detail.',
}

export default function HowItWorksPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="smallcaps text-sm text-seal">How it works</p>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight sm:text-6xl">
        The life of a <em className="text-seal">budget</em>.
      </h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-2">
        Only three moments touch the blockchain: locking the budget, collecting, and taking back what was left. Every
        payment in between is a signed slip checked in milliseconds. Scroll to watch the money move, or switch to
        Technical for the exact data.
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
