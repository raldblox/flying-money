import { liveMainnets, liveNetworks } from '@/lib/networks'
import { InkMountains } from './art/ink-mountains'
import { LiveTally } from './art/live-tally'
import { ButtonLink } from './section'

const H1 = 'mt-4 font-display text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-balance sm:text-[3.9rem]'

/**
 * The promise (§22.4), led by what only Flying Money does: a payment is a signed slip that needs no connection,
 * checked on the spot and guaranteed because the money is set aside for that seller.
 */
export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden">
      <InkMountains className="pointer-events-none absolute inset-x-0 bottom-0 h-[42%] w-full opacity-70" />
      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-20 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:pb-28 lg:pt-16">
        <div className="rise min-w-0">
          <p className="smallcaps text-sm text-seal">
            <span lang="zh-Hant">飛錢</span> Flying Money · money that flies, since 804
          </p>
          <h1 id="hero-title" className={H1}>
            Payments that work <em className="text-seal">without the internet.</em>
          </h1>
          <p className="mt-5 max-w-xl text-xl leading-relaxed text-ink">
            Earmark digital dollars for a shop, an API or a charger: they’re as good as paid to that seller, even
            offline, and useless to anyone else. An agent, a phone or a robot pays with a signed slip that travels by QR
            code, sound, the shop’s Wi-Fi or a link. People just tap and pay: no crypto wallet, no network fees, no seed
            phrase.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/demo/counter">Play the offline counter →</ButtonLink>
            <ButtonLink href="/demo/slip" variant="secondary">
              Get a slip that pays
            </ButtonLink>
          </div>
          <p className="mt-6 font-display text-2xl font-semibold">
            Give a budget. <em className="text-seal">Not your wallet.</em>
          </p>
          <p className="mt-2 max-w-xl text-ink-2">
            The payer holds only its own key, which holds no money. You set the seller, the amount and the end date, and
            take back what’s left.{' '}
            <a
              href="/demo"
              className="font-medium text-ink underline decoration-seal/50 underline-offset-4 hover:decoration-seal"
            >
              Watch an agent pay →
            </a>
          </p>
          <p className="mt-7 text-sm text-ink-2">
            Live on the {liveNetworks()} test networks{liveMainnets() && <> and {liveMainnets()} mainnet (capped)</>} ·
            Open source (MIT) · Not yet audited ·{' '}
            <a
              href="/chains"
              className="font-medium text-ink underline decoration-seal/50 underline-offset-4 hover:decoration-seal"
            >
              See networks →
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
            Money earmarked for the tea house. <em className="text-seal">Paid by slips, online or off.</em>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
