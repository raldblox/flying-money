'use client'
import { InkMountains } from './art/ink-mountains'
import { LiveTally } from './art/live-tally'
import { DoorStack, DoorToggle, useDoor } from './door'
import { ButtonLink } from './section'

const H1 = 'mt-4 font-display text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-balance sm:text-[3.9rem]'

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <InkMountains className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] w-full opacity-70" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:pb-28 lg:pt-16">
        <div className="rise min-w-0">
          <p className="smallcaps text-sm text-seal">
            <span lang="zh-Hant">飛錢</span> Flying Money · open source · test network
          </p>
          {/* the promise, visible (§22.4); the two doors below only swap the example */}
          <h1 id="hero-title" className={H1}>
            Give a budget. <em className="text-seal">Not your wallet.</em>
          </h1>
          <p className="mt-5 max-w-xl text-xl leading-relaxed text-ink">
            Fund a budget for a seller you choose. Use it yourself, or let a person or an AI assistant use it. See what
            was spent and what’s left.
          </p>
          <DoorToggle className="mt-6" />
          <DoorStack
            className="mt-5"
            agents={
              <>
                <p className="max-w-xl text-lg leading-relaxed text-ink-2">
                  Set a budget in digital dollars (USDC) for one API or service. Your agent pays per request, the
                  service checks each payment on the spot, and collects the total later in one transaction. The agent
                  can’t raise its budget or spend past it, even if its key is stolen. After the end date, you can take
                  back what’s left.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <ButtonLink href="/demo">Watch an agent pay →</ButtonLink>
                  <ButtonLink href="/docs/agents" variant="secondary">
                    Add it to your agent
                  </ButtonLink>
                </div>
              </>
            }
            people={
              <>
                <p className="max-w-xl text-lg leading-relaxed text-ink-2">
                  Load a budget for one place (a canteen, a café, a supplier) with a limit and an end date. Your kid,
                  employee or friend pays by showing a QR code on their phone. They don’t need a crypto wallet and never
                  pay a network fee. After the end date, you can take back what they didn’t spend.
                </p>
                <div className="mt-7 flex flex-wrap gap-3">
                  <ButtonLink href="/shops">See how a café uses it →</ButtonLink>
                  <ButtonLink href="/shop" variant="secondary">
                    Open a till for your shop
                  </ButtonLink>
                </div>
              </>
            }
          />
          <p className="mt-7 text-sm text-ink-2">
            Live on Arbitrum Sepolia with test money · Open source (MIT) · Not yet audited ·{' '}
            <a
              href="/chains"
              className="font-medium text-ink underline decoration-seal/50 underline-offset-4 hover:decoration-seal"
            >
              See networks →
            </a>
          </p>
        </div>
        <HeroCard />
      </div>
    </section>
  )
}

const CARDS = {
  agents: {
    face: 500,
    payee: 'Silk Road Oracle',
    holder: 'Research agent',
    expires: '7 days',
    floor: 180,
    items: [
      ['Weather lookup', 12],
      ['Market data', 25],
      ['Web search', 8],
      ['Map tiles', 15],
      ['Translation', 10],
    ],
    caption: (
      <>
        A controlled budget for your agent. <em className="text-seal">One service, your limit.</em>
      </>
    ),
  },
  people: {
    face: 2000,
    payee: 'Lantern Café',
    holder: 'Mia',
    expires: '30 days',
    floor: 650,
    items: [
      ['Oat latte', 350],
      ['Croissant', 280],
      ['Iced tea', 300],
      ['Soup of the day', 420],
    ],
    caption: (
      <>
        A controlled budget for Mia. <em className="text-seal">One café, your limit.</em>
      </>
    ),
  },
} as const

/** One live card for the chosen door. Switching doors re-mounts it, so its two halves join again. */
function HeroCard() {
  const { door } = useDoor()
  const c = CARDS[door]
  return (
    <figure className="mx-auto w-full max-w-[34rem]">
      <LiveTally key={door} {...c} />
      <figcaption className="mt-3 min-h-[3.5rem] text-center font-display text-xl leading-snug text-ink">
        {c.caption}
      </figcaption>
    </figure>
  )
}
