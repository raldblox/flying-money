import type { Metadata } from 'next'
import { IconBowl, IconGift, IconTea, IconWorker } from '@/components/art/ink-icons'
import { TallyArt } from '@/components/art/tally'
import { ButtonLink, Sheet } from '@/components/section'

export const metadata: Metadata = {
  title: 'For people & shops',
  description:
    'A prepaid certificate for the places you pay often. Capped for the holder, reserved for the shop. Pay by showing a QR code, even when the Wi‑Fi is down.',
}

const USES = [
  {
    Icon: IconTea,
    t: 'Regulars’ tabs',
    d: '20 USDC at the café you visit every morning. Pay with your phone, no card.',
  },
  {
    Icon: IconBowl,
    t: 'Allowances',
    d: 'Lunch money that only works at the school canteen. Renew it each week, or don’t.',
  },
  { Icon: IconWorker, t: 'Team spend', d: 'Fuel money for a field worker, at one station. No company card to lose.' },
  { Icon: IconGift, t: 'Gifts', d: 'A gift for one shop, sent as a link. Unspent money comes back to you.' },
]

/** /shops (§10.1): the second front door, for people and shops. */
export default function ShopsPage() {
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-4 pb-10 pt-14 sm:px-6 lg:grid-cols-[1.1fr_1fr]">
        <div>
          <p className="smallcaps text-sm text-seal">For people & shops</p>
          <h1 className="mt-3 font-display text-5xl font-semibold leading-[1.02] tracking-tight text-balance sm:text-6xl">
            A prepaid certificate for the places you pay often. <em className="text-seal">Capped</em> for the holder,{' '}
            <em className="text-seal">reserved</em> for the shop.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-2">
            Give your kid, employee or friend a certificate for one place, with a hard limit. They pay by showing a QR
            code, even when the shop’s Wi‑Fi is down. They don’t need a crypto wallet or pay any fees. Whatever they
            don’t spend comes back to you.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href="/app">Give a certificate →</ButtonLink>
            <ButtonLink href="/shop" variant="secondary">
              Open a till for your shop
            </ButtonLink>
          </div>
        </div>
        <TallyArt face="20.00" payee="Lantern Café" holder="Mia" expires="30 days" className="w-full" />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-labelledby="uses">
        <h2 id="uses" className="font-display text-4xl font-semibold">
          Anyone who spends on your behalf.
        </h2>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {USES.map(({ Icon, t, d }) => (
            <li key={t}>
              <Sheet className="h-full p-6">
                <Icon className="size-12" />
                <h3 className="mt-3 font-display text-2xl font-semibold">{t}</h3>
                <p className="mt-1 text-ink-2">{d}</p>
              </Sheet>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6" aria-labelledby="counter">
        <h2 id="counter" className="font-display text-4xl font-semibold">
          At the counter, in three taps.
        </h2>
        <ol className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            ['The till shows a price code', 'The shop taps “Tea 3.50”. A QR code appears.'],
            ['The customer shows their code', 'Scan it, check “Pay 3.50 to Lantern Café”, enter the PIN, show the QR.'],
            ['Accepted', 'The till checks it on the spot, stamps the seal, and collects later in one transaction.'],
          ].map(([t, d], k) => (
            <li key={t}>
              <Sheet className="h-full p-6">
                <p className="smallcaps text-xs text-seal">Step {k + 1}</p>
                <h3 className="mt-1 font-display text-2xl font-semibold">{t}</h3>
                <p className="mt-1 text-ink-2">{d}</p>
              </Sheet>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6" aria-labelledby="honest">
        <Sheet className="grid gap-8 p-8 md:grid-cols-2">
          <div>
            <h2 id="honest" className="font-display text-3xl font-semibold">
              What you control
            </h2>
            <ul className="ledger mt-3 leading-[2.25rem]">
              <li>Where it can be spent: one shop per certificate.</li>
              <li>How much, and topping it up.</li>
              <li>How long, and extending it, or not renewing.</li>
            </ul>
          </div>
          <div>
            <h2 className="font-display text-3xl font-semibold text-ink-2">What you can’t do, on purpose</h2>
            <ul className="ledger mt-3 leading-[2.25rem] text-ink-2">
              <li>Freeze or cancel it before the end date.</li>
              <li>Block one purchase at the allowed shop.</li>
            </ul>
            <p className="mt-3 text-sm text-ink-2">
              That is why a shop can accept it instantly, even offline. Payments are public on the blockchain but not
              linked to names.{' '}
              <a className="text-indigo underline" href="/docs/shops">
                How it works for people and shops →
              </a>
            </p>
          </div>
        </Sheet>
      </section>
    </>
  )
}
