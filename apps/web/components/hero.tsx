'use client'
import { useState } from 'react'
import { InkMountains } from './art/ink-mountains'
import { TallyArt } from './art/tally'
import { ButtonLink } from './section'

const DOORS = {
  agents: {
    h1: (
      <>
        Give your AI agent a <em className="text-seal">sealed certificate</em>, not your wallet.
      </>
    ),
    sub: 'Lock a budget for one seller. Your agent pays per request with signed notes the seller checks instantly. The seller redeems everything in one transaction. Your agent can’t spend past the limit, and every note it signs is backed by money reserved for that seller.',
    card: { face: '5.00', payee: 'Silk Road Oracle', holder: 'Research agent', expires: '7 days' },
  },
  people: {
    h1: (
      <>
        A prepaid certificate for the places you pay often. <em className="text-seal">Capped</em> for the holder,{' '}
        <em className="text-seal">reserved</em> for the shop.
      </>
    ),
    sub: 'Give your kid, employee or friend a certificate for one place, with a hard limit. They pay by showing a QR code, even when the shop’s Wi‑Fi is down. No wallet, no crypto, no gas for them. Unused balance returns to you.',
    card: { face: '20.00', payee: 'Lantern Café', holder: 'Mia', expires: '30 days' },
  },
} as const

export function Hero() {
  const [door, setDoor] = useState<keyof typeof DOORS>('agents')
  const d = DOORS[door]
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <InkMountains className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] w-full opacity-70" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-24 pt-12 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:pb-32 lg:pt-16">
        <div className="rise">
          <p className="smallcaps text-sm text-seal">
            <span lang="zh-Hant">飛錢</span> · Chang’an, 804 CE → the internet, today
          </p>
          <h1
            id="hero-title"
            className="mt-4 font-display text-[2.9rem] font-semibold leading-[1.02] tracking-tight text-balance sm:text-[4.2rem]"
          >
            {d.h1}
          </h1>
          <fieldset className="mt-7 inline-flex rounded-[4px] border border-ink/25 bg-paper/70 p-1 backdrop-blur-[1px]">
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
                className={`min-h-10 rounded-[3px] px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo ${door === k ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </fieldset>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">{d.sub}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/demo">Watch an agent pay →</ButtonLink>
            <ButtonLink href="#story" variant="secondary">
              Read the 804 CE story
            </ButtonLink>
          </div>
          <p className="mt-8 text-sm text-ink-2">
            <a
              href="/chains"
              className="font-medium text-ink underline decoration-seal/50 underline-offset-4 hover:decoration-seal"
            >
              Arbitrum · Monad · Arc · Base
            </a>{' '}
            — same protocol, every chain. <span className="smallcaps">Testnets + capped mainnets · unaudited</span>
          </p>
        </div>
        <figure className="relative mx-auto w-full max-w-[34rem]" key={door}>
          <TallyArt {...d.card} className="w-full drop-shadow-[0_18px_30px_rgb(60_40_10/0.22)]" />
          <figcaption className="mt-2 text-center text-sm italic text-ink-2">
            The seal spans both halves: whole only when they meet.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
