'use client'
import { useState } from 'react'
import { CertificateCard } from './certificate-card'
import { ButtonLink } from './section'

const DOORS = {
  agents: {
    h1: 'Give your AI agent a sealed certificate, not your wallet.',
    sub: 'Lock a budget for one seller. Your agent pays per request with signed notes the seller checks instantly. The seller redeems everything in one transaction. Your agent can’t spend past the limit, and every note it signs is backed by money reserved for that seller.',
    card: { face: '5.00', payee: 'Silk Road Oracle', holder: 'Research agent', expires: '7 days' },
  },
  people: {
    h1: 'A prepaid certificate for the places you pay often. Capped for the holder, reserved for the shop.',
    sub: 'Give your kid, employee or friend a certificate for one place, with a hard limit. They pay by showing a QR code, even when the shop’s Wi‑Fi is down. No wallet, no crypto, no gas for them. Unused balance returns to you.',
    card: { face: '20.00', payee: 'Lantern Café', holder: 'Mia', expires: '30 days' },
  },
} as const

export function Hero() {
  const [door, setDoor] = useState<keyof typeof DOORS>('agents')
  const d = DOORS[door]
  return (
    <section
      aria-labelledby="hero-title"
      className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-16 pt-14 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-20"
    >
      <div>
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-seal">
          <span lang="zh-Hant">飛錢</span> · Flying Money
        </p>
        <h1
          id="hero-title"
          className="mt-4 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-balance sm:text-6xl"
        >
          {d.h1}
        </h1>
        <fieldset className="mt-6 inline-flex rounded-md border border-line bg-paper-2 p-1">
          <legend className="sr-only">Who is spending?</legend>
          {(
            [
              ['agents', 'For agents'],
              ['people', 'For people & shops'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={door === k}
              onClick={() => setDoor(k)}
              className={`min-h-10 rounded px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo ${door === k ? 'bg-paper text-ink shadow-sm' : 'text-ink-2 hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </fieldset>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">{d.sub}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/demo">Watch an agent pay</ButtonLink>
          <ButtonLink href="#story" variant="secondary">
            Read the 804 CE story
          </ButtonLink>
        </div>
        <p className="mt-8 text-sm text-ink-2">
          <a href="/chains" className="underline decoration-line hover:decoration-ink">
            Arbitrum · Monad · Arc · Base
          </a>{' '}
          · Same protocol, every chain · Testnets + capped mainnets · unaudited
        </p>
      </div>
      <CertificateCard {...d.card} caption="Illustration. The seal appears only on real, on-chain certificates." />
    </section>
  )
}
