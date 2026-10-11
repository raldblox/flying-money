import { liveMainnets, liveNetworks } from '@/lib/networks'
import { InkMountains } from './art/ink-mountains'
import { LiveTally } from './art/live-tally'
import { ButtonLink } from './section'

const H1 = 'mt-4 font-display text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-balance sm:text-[3.9rem]'

/**
 * The promise, led by what only Flying Money does: a payment is a signed slip that needs no connection, checked on the
 * spot because the money is already set aside for that seller. It fills the first screen; the mountains sit behind it
 * and fade out at both edges, so nothing is cropped or cut by a hard line.
 */
export function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="relative isolate flex min-h-[calc(100svh-5.75rem)] items-center overflow-hidden"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-[56%] [mask-image:linear-gradient(to_bottom,transparent,black_28%,black_72%,transparent)]"
      >
        {/* the left of the picture fades out, so the text column stays clean */}
        <div className="h-full w-full [mask-image:linear-gradient(to_right,transparent_8%,black_52%)]">
          <InkMountains className="h-full w-full opacity-70" />
        </div>
      </div>
      <div className="relative mx-auto grid w-full max-w-6xl items-center gap-10 px-4 pb-24 pt-8 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:pb-28 lg:pt-10">
        <div className="rise min-w-0">
          <p className="smallcaps text-sm text-seal">
            <span lang="zh-Hant">飛錢</span> Flying Money · money that flies, since 804
          </p>
          <h1 id="hero-title" className={H1}>
            Payments that work <em className="text-seal">without the internet.</em>
          </h1>
          <p className="mt-5 max-w-xl text-xl leading-relaxed text-ink">
            Set money aside for one seller. A phone, an AI agent or a robot pays with signed slips the seller can check
            on the spot, then collect later. <strong className="font-semibold">Give a budget, not your wallet.</strong>
          </p>
          <p className="mt-3 max-w-xl text-sm text-ink-2">
            Once a seller has checked a funded budget online, it can verify its payment slips offline and collect before
            the budget expires. Nobody who pays needs a crypto wallet.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/demo/counter">Play the shop demo →</ButtonLink>
            <ButtonLink href="/#demos" variant="secondary">
              All three demos
            </ButtonLink>
          </div>
          <p className="mt-4 text-sm text-ink-2">
            About 2 minutes each · We supply the test funds · No wallet to connect
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
          <figcaption className="mt-3 text-center font-display text-xl leading-snug text-ink">
            A budget, spent one slip at a time.
            <span className="mt-1 block font-sans text-xs text-ink-2">
              An illustration. The demos below make real payments on test networks.
            </span>
          </figcaption>
        </figure>
      </div>
      <a
        href="#demos"
        className="absolute inset-x-0 bottom-5 mx-auto w-fit rounded px-3 py-2 text-sm text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-indigo"
      >
        Choose a demo ↓
      </a>
    </section>
  )
}
