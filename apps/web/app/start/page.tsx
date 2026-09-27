import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Get started',
  description: 'Choose what you want to do: give a budget, let your AI assistant pay, use a budget, or take payments.',
}

/** The start page (BUILD_SPEC §22.10 c): four plain choices, each leading to one guided path. */
const CHOICES = [
  {
    href: '/app/give?for=person',
    t: 'Give someone a budget',
    d: 'Money for one place, like a canteen or a café, with a limit and an end date. They pay with their phone.',
    need: 'You need a browser wallet with test USDC.',
    icon: 'M12 5v14M5 12h14',
  },
  {
    href: '/app/connect',
    t: 'Let my AI assistant pay',
    d: 'Send your assistant one message. It sets itself up and asks you before it spends on a service.',
    need: 'You approve each budget from your wallet.',
    icon: 'M5 7h14v10H5zM9 11l2 2-2 2M13 15h3',
  },
  {
    href: '/wallet',
    t: 'Use a budget I was given',
    d: 'Open a budget someone sent you and pay at the counter by showing a QR code.',
    need: 'No crypto wallet and no fees.',
    icon: 'M4 7h16v12H4zM4 11h16M8 15h4',
  },
  {
    href: '/shop',
    t: 'Take payments at my shop',
    d: 'Open a till on this device in three steps, and show customers how to get a budget for your shop.',
    need: 'You need a wallet address to receive sales.',
    icon: 'M4 9h16l-1.5-4h-13zM5 9v10h14V9M9 19v-5h6v5',
  },
] as const

export default function StartPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:py-16">
      <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">What would you like to do?</h1>
      <p className="mt-3 max-w-2xl text-lg text-ink-2">Pick one. Each choice walks you through it. Test money only.</p>
      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {CHOICES.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="sheet flex h-full gap-4 p-5 transition-transform hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-indigo motion-reduce:transition-none"
            >
              <svg
                viewBox="0 0 24 24"
                className="mt-1 size-7 shrink-0 text-seal"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <path d={c.icon} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span>
                <span className="block font-display text-2xl font-semibold">{c.t} →</span>
                <span className="mt-1 block text-ink-2">{c.d}</span>
                <span className="mt-2 block text-sm text-ink-2">{c.need}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="mt-8 text-ink-2">
        Just looking?{' '}
        <Link href="/demo" className="text-indigo underline">
          Watch an agent pay
        </Link>{' '}
        or read{' '}
        <Link href="/how-it-works" className="text-indigo underline">
          how it works
        </Link>
        .
      </p>
    </div>
  )
}
