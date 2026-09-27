import { isChainKey } from '@flying-money/chains'
import type { Metadata } from 'next'
import { CounterScene } from '@/components/art/counter-scene'
import { IconBowl, IconGift, IconTea, IconWorker } from '@/components/art/ink-icons'
import { TallyArt } from '@/components/art/tally'
import { ButtonLink, Sheet } from '@/components/section'

export const metadata: Metadata = {
  title: 'Families & shops',
  description:
    'Prepaid money for one place, with a limit that holds. They pay with their phone; the shop gets paid from money already set aside for it.',
}

const USES = [
  { Icon: IconBowl, t: 'School lunch', d: 'Lunch money that only works at the canteen.' },
  { Icon: IconTea, t: 'A café tab', d: '20 USDC at your regular’s favourite café.' },
  { Icon: IconWorker, t: 'Field staff', d: 'Fuel money for one station, with no company card to lose.' },
  { Icon: IconGift, t: 'A gift for one shop', d: 'Sent as a link. After the end date, you take back what’s left.' },
]

const SECTIONS = [
  {
    eyebrow: 'For givers',
    title: 'You decide where, how much and how long.',
    items: [
      'Pick the place, the amount and the end date, then send it as a link or QR code.',
      'Top up or extend at any time. When the end date comes, take back the leftovers.',
      'The holder needs no crypto wallet and pays no fees. You need USDC to give.',
      'What you can’t do: cancel a budget early or block one purchase. That is what lets the shop accept on the spot.',
    ],
  },
  {
    eyebrow: 'For holders',
    title: 'Pay by showing your phone.',
    items: [
      'Open the link and choose a PIN. Your budget lives on this phone.',
      'At the counter: tap Pay, scan the price, check the amount, enter your PIN, show your code.',
      'Add the wallet to your home screen and save a backup, so your phone doesn’t clear it.',
    ],
  },
  {
    eyebrow: 'For shops',
    title: 'Regulars pay in seconds. You collect once a day.',
    items: [
      'Open a till in your browser. No card terminal, no monthly fee from us.',
      'Each payment is checked on the till itself, so returning customers can still pay when your Wi‑Fi is down.',
      'New customers while you’re offline are marked Unverified, and your risk is capped by a first-visit limit you set (5 USDC by default).',
      'Tap Collect to move the day’s payments to your account in one transfer.',
    ],
  },
]

/** /shops (§10.1): the families & shops door. People-side words only (§21.3). */
export default async function ShopsPage({ searchParams }: { searchParams: Promise<{ chain?: string }> }) {
  const { chain } = await searchParams
  const q = chain && isChainKey(chain) ? `?chain=${chain}` : ''
  return (
    <>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-10 pt-10 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:gap-12 lg:pt-14">
        <div className="min-w-0">
          <p className="smallcaps text-sm text-seal">For families & shops</p>
          <h1 className="mt-3 font-display text-[2.6rem] font-semibold leading-[1.04] tracking-tight text-balance sm:text-6xl">
            Prepaid money for one place. <em className="text-seal">With a limit that holds.</em>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-2">
            Give lunch money that only works at the canteen, a café tab for your regular, or fuel money for one station.
            They pay with their phone. The shop gets paid from money already set aside for it.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={`/app${q}`}>Give a budget →</ButtonLink>
            <ButtonLink href={`/shop${q}`} variant="secondary">
              Open a till
            </ButtonLink>
          </div>
        </div>
        <figure className="mx-auto w-full max-w-[34rem]">
          <TallyArt face="20.00" payee="Lantern Café" holder="Mia" expires="30 days" className="w-full" />
          <figcaption className="mt-2 text-center text-sm italic text-ink-2">
            20.00 USDC that only works at Lantern Café, for 30 days.
          </figcaption>
        </figure>
      </section>

      <section className="mx-auto max-w-4xl px-4 py-10 sm:px-6" aria-labelledby="counter">
        <p className="smallcaps text-sm text-seal">At the counter</p>
        <h2 id="counter" className="mt-1 font-display text-3xl font-semibold sm:text-4xl">
          Five seconds, no card, no terminal.
        </h2>
        <div className="mt-6">
          <CounterScene />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6" aria-labelledby="uses">
        <h2 id="uses" className="font-display text-3xl font-semibold sm:text-4xl">
          For the places you pay often.
        </h2>
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {USES.map(({ Icon, t, d }) => (
            <li key={t}>
              <Sheet className="flex h-full gap-4 p-5 sm:block">
                <Icon className="size-11 shrink-0 sm:size-12" />
                <div>
                  <h3 className="font-display text-2xl font-semibold sm:mt-3">{t}</h3>
                  <p className="mt-1 text-ink-2">{d}</p>
                </div>
              </Sheet>
            </li>
          ))}
        </ul>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:px-6 lg:grid-cols-3">
        {SECTIONS.map((sec) => (
          <Sheet key={sec.eyebrow} as="section" className="p-6">
            <p className="smallcaps text-sm text-seal">{sec.eyebrow}</p>
            <h2 className="mt-1 font-display text-2xl font-semibold sm:text-3xl">{sec.title}</h2>
            <ul className="mt-4 grid gap-3">
              {sec.items.map((i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-seal" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </Sheet>
        ))}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-20 pt-4 sm:px-6">
        <div className="flex flex-wrap gap-3">
          <ButtonLink href={`/shop${q}`}>Open a till</ButtonLink>
          <ButtonLink href={`/app${q}`} variant="secondary">
            Give a budget
          </ButtonLink>
          <ButtonLink href="/wallet" variant="secondary">
            Open my wallet
          </ButtonLink>
        </div>
        <p className="mt-6 text-sm text-ink-2">
          Payments are public on the blockchain but not linked to names. Test network, not yet audited.{' '}
          <a className="text-indigo underline" href="/docs/shops">
            How it works for families and shops →
          </a>
        </p>
      </section>
    </>
  )
}
