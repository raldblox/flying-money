import { liveMainnets, liveNetworks } from '@/lib/networks'
import { InkMountains } from './art/ink-mountains'
import { LiveTally } from './art/live-tally'
import { ButtonLink } from './section'

const H1 = 'mt-4 font-display text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-balance sm:text-[3.9rem]'

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <InkMountains className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] w-full opacity-70" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-12 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:pb-16 lg:pt-16">
        <div className="rise min-w-0">
          <p className="smallcaps text-sm text-seal">For people, shops and AI agents</p>
          <h1 id="hero-title" className={H1}>
            Give a budget.
            <br />
            <em className="text-seal">Not your wallet.</em>
          </h1>
          <p className="mt-5 max-w-xl text-xl leading-relaxed text-ink">
            Let a person or an agent pay from money you set aside for one seller. You choose the amount and end date.
            They pay with signed slips, within those limits.
          </p>
          <p className="mt-4 max-w-xl text-ink-2">
            Once a seller has checked the funded budget online, it can check payment slips offline and collect before
            the budget expires.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/#demos">Choose your demo →</ButtonLink>
            <ButtonLink href="/how-it-works" variant="secondary">
              How it works
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-ink-2">
            Two guided experiences · We provide test funds · No wallet to connect
          </p>
          <p className="mt-6 text-xs leading-relaxed text-ink-2">
            Open source · Not yet audited · Live on {liveNetworks()} test networks
            {liveMainnets() && <> and {liveMainnets()} mainnet (capped)</>}.{' '}
            <a href="/chains" className="underline underline-offset-4">
              See deployments
            </a>
          </p>
        </div>
        <figure className="mx-auto w-full max-w-[34rem]">
          <LiveTally
            face={500}
            payee="Tea house till"
            holder="A phone, offline"
            expires="7 days"
            floor={180}
            items={[
              ['Green tea', 12],
              ['Dumplings', 25],
              ['Charging, 10 min', 8],
              ['Map tiles', 15],
              ['Translation', 10],
            ]}
          />
          <figcaption className="mt-3 min-h-[3.5rem] text-center font-display text-xl leading-snug text-ink">
            An illustrated budget, spent one slip at a time.
            <span className="mt-1 block font-sans text-xs text-ink-2">
              Illustration only · Try a demo below to make real test-network payments.
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
