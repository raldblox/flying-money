import {
  IconAgent,
  IconBowl,
  IconGift,
  IconIssue,
  IconRedeem,
  IconSeal,
  IconServe,
  IconTea,
  IconWorker,
} from '@/components/art/ink-icons'
import { SilkRoadMap } from '@/components/art/silk-road-map'
import { CodeTabs } from '@/components/code-tabs'
import { Hero } from '@/components/hero'
import { ButtonLink, Chapter, Sheet } from '@/components/section'
import { SealLogo } from '@/components/site-header'

const BUY = `import { createFlyingMoneyClient, fileStore } from '@flying-money/client'
import { privateKeyToAccount } from 'viem/accounts'

const fm = createFlyingMoneyClient({
  chains: ['arbitrum-sepolia'],
  spender: privateKeyToAccount(process.env.AGENT_KEY),
  store: fileStore('.flying-money.json'),        // durable outbox
  certificates: ['0x…'],                          // issued by your funder
  maxPricePerRequest: 50_000n,                    // 0.05 USDC
})
const res = await fm.fetch('https://oracle.example/v1/tea-price?city=Luoyang')`

const SELL = `import { flyingMoney } from '@flying-money/server/hono'
import { upstashStore } from '@flying-money/server'

app.use('/v1/*', flyingMoney({
  accepts: ['arbitrum-sepolia'],
  payee: process.env.PAYEE_ADDRESS,
  price: () => 10_000n,                           // 0.01 USDC per request
  store: upstashStore({ url, token }),            // durable, shared state
}))
app.get('/v1/tea-price', (c) => c.json({ price: 42 }))`

const WORKED = [
  ['Deposit before travel', 'prefunded', 'The certificate is funded before anyone spends.'],
  ['Tied to one redemption', 'scoped', 'It pays one named seller, nobody else.'],
  ['Halves that must match', 'verifiable', 'A signature checked against the chain record.'],
  ['Value moved, coins stayed', 'deferred settlement', 'Many payments, one redemption.'],
]

const STEPS = [
  { Icon: IconIssue, t: 'Issue', d: 'Lock 5 USDC for one seller, usable by one agent key, until a date.' },
  { Icon: IconSeal, t: 'Seal', d: 'Every request carries a signed note: “total so far: 0.37”.' },
  {
    Icon: IconServe,
    t: 'Serve',
    d: 'The seller verifies the note locally in milliseconds. No transaction, no waiting. It keeps working if the network blinks.',
  },
  {
    Icon: IconRedeem,
    t: 'Redeem',
    d: 'The seller redeems the latest note in one transaction. Leftover funds return to you after expiry.',
  },
]

const HOLDERS = [
  { Icon: IconAgent, t: 'Agents', d: 'A research agent with 5 USDC for one data API.', tilt: -2 },
  { Icon: IconTea, t: 'Regulars’ tabs', d: '20 USDC at the café you visit every morning.', tilt: 1.5 },
  { Icon: IconBowl, t: 'Allowances', d: 'Lunch money that only works at the school canteen.', tilt: -1 },
  { Icon: IconWorker, t: 'Teams', d: 'Fuel money for a field worker, at one station.', tilt: 2 },
  { Icon: IconGift, t: 'Gifts', d: 'A gift for one shop, sent as a link.', tilt: -1.5 },
]

export default function Home() {
  return (
    <>
      <Hero />

      <Chapter id="story" n={1} eyebrow="Chang’an, 804 CE" title="The merchants who stopped carrying coins.">
        <Sheet as="article" className="px-6 py-10 sm:px-12 sm:py-14">
          <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div className="text-lg leading-relaxed">
              <p className="first-letter:float-left first-letter:mr-3 first-letter:font-display first-letter:text-7xl first-letter:leading-[0.8] first-letter:text-seal">
                Tea merchants in Tang-dynasty China faced a shortage of copper coin and dangerous roads. So they
                deposited coin with an official office and carried a certificate instead, made of matching halves and
                redeemed in another city.
              </p>
              <p className="mt-5">
                People called it{' '}
                <span lang="zh-Hant" className="font-han text-seal">
                  飛錢
                </span>
                , <em className="font-display text-2xl">flying money</em>. The value travelled; the coins stayed safe.
              </p>
              <p className="mt-5 text-ink-2">
                Twelve centuries later, AI agents are the new merchants and APIs are the new cities. They need the same
                three properties that made flying money work.
              </p>
            </div>
            <aside aria-label="What made it work" className="border-l-2 border-seal/40 pl-6">
              <p className="smallcaps text-sm text-seal">What made it work</p>
              <dl className="mt-3 space-y-4">
                {WORKED.map(([a, b, c]) => (
                  <div key={a}>
                    <dt className="font-display text-xl font-semibold">
                      {a} <span className="text-base font-normal italic text-seal">({b})</span>
                    </dt>
                    <dd className="text-ink-2">{c}</dd>
                  </div>
                ))}
              </dl>
            </aside>
          </div>
          <SilkRoadMap className="mt-10 w-full" />
          <p className="mt-4 text-sm text-ink-2">
            Sources:{' '}
            <a className="text-indigo underline decoration-indigo/40" href="https://en.wikipedia.org/wiki/Flying_cash">
              Wikipedia, “Flying cash”
            </a>{' '}
            ·{' '}
            <a className="text-indigo underline decoration-indigo/40" href="https://www.britannica.com/topic/feiqian">
              Britannica, “Feiqian”
            </a>
          </p>
        </Sheet>
      </Chapter>

      <Chapter id="problem" n={2} eyebrow="Today" title="The new merchants are machines.">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <Sheet className="ledger px-6 py-6 sm:px-10" tilt={-0.6}>
            <p className="smallcaps text-sm text-ink-2">Ways to let an agent pay</p>
            <ol className="mt-2">
              {[
                ['Give it your card?', 'unbounded risk if it loops or gets hijacked'],
                ['Pay on-chain per request?', 'too slow and too costly at a tenth of a cent a call'],
                ['Promise to pay later?', 'sellers can’t trust an anonymous agent'],
              ].map(([q, why]) => (
                <li key={q} className="flex flex-wrap items-baseline gap-x-3 py-[0.45rem] leading-[2.25rem]">
                  <span className="relative font-display text-2xl font-semibold text-ink-2">
                    {q}
                    <span aria-hidden className="absolute inset-x-[-4px] top-1/2 h-[2px] -rotate-2 bg-seal/80" />
                  </span>
                  <span className="text-ink-2">— {why}.</span>
                </li>
              ))}
              <li className="py-[0.45rem] leading-[2.25rem]">
                <span className="font-display text-3xl font-semibold">
                  Give it a <em className="text-seal">certificate.</em>
                </span>
              </li>
            </ol>
          </Sheet>
          <p className="text-xl leading-relaxed text-ink-2">
            Agents buy API calls, data and compute thousands of times a day, for fractions of a cent. A certificate
            gives them a <strong className="text-ink">budget for one seller</strong>, a{' '}
            <strong className="text-ink">key of their own</strong>, and{' '}
            <strong className="text-ink">a date it ends</strong>. Nothing more to trust.
          </p>
        </div>
      </Chapter>

      <Chapter id="how" n={3} eyebrow="How it works" title="Issue. Seal. Serve. Redeem.">
        <div className="relative">
          <svg
            aria-hidden
            className="absolute left-0 top-10 hidden h-4 w-full md:block"
            preserveAspectRatio="none"
            viewBox="0 0 100 4"
          >
            <path
              d="M2 2 C 30 0, 60 4, 98 2"
              fill="none"
              stroke="var(--seal)"
              strokeWidth="0.35"
              strokeDasharray="1.4 1.4"
            />
          </svg>
          <ol className="relative grid gap-10 md:grid-cols-4 md:gap-6">
            {STEPS.map(({ Icon, t, d }, k) => (
              <li key={t}>
                <span className="relative grid size-20 place-items-center rounded-full bg-paper text-ink shadow-[var(--sheet-shadow)] ring-1 ring-line">
                  <Icon className="size-12" />
                  <span
                    className="absolute -right-1 -top-1 grid size-7 place-items-center rounded-[3px] bg-seal font-han text-sm text-paper"
                    lang="zh-Hant"
                    aria-hidden
                  >
                    {['一', '二', '三', '四'][k]}
                  </span>
                </span>
                <h3 className="mt-5 font-display text-3xl font-semibold">{t}</h3>
                <p className="mt-2 max-w-xs text-ink-2">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </Chapter>

      <Chapter id="guarantees" n={4} eyebrow="Guarantees" title="What the math guarantees, and what it doesn’t.">
        <Sheet className="overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="p-8 sm:p-10">
              <h3 className="font-display text-2xl font-semibold">
                <span className="text-seal">✓</span> Guaranteed
              </h3>
              <ul className="ledger mt-3 leading-[2.25rem]">
                <li>The spender can’t authorize beyond the face value, even with a stolen key.</li>
                <li>Every redeemable note is backed by funds reserved for that seller until expiry.</li>
                <li>Anyone can redeem, but the value only reaches the named seller.</li>
                <li>You get the remainder back after expiry.</li>
              </ul>
            </div>
            <div className="border-t border-dashed border-seal/40 p-8 sm:p-10 md:border-l md:border-t-0">
              <h3 className="font-display text-2xl font-semibold text-ink-2">Not guaranteed</h3>
              <ul className="ledger mt-3 leading-[2.25rem] text-ink-2">
                <li>That the seller delivers.</li>
                <li>That the seller redeems before expiry (its SDK does this automatically).</li>
                <li>Stablecoin freezes.</li>
                <li>This is unaudited testnet software.</li>
              </ul>
            </div>
          </div>
        </Sheet>
        <p className="mt-6">
          <a
            href="/guarantees"
            className="font-medium text-indigo underline decoration-indigo/40 underline-offset-4 hover:decoration-indigo"
          >
            The full guarantees and threat model →
          </a>
        </p>
      </Chapter>

      <Chapter id="people" n={5} eyebrow="Not only agents" title="Anyone who spends on your behalf.">
        <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-5">
          {HOLDERS.map(({ Icon, t, d, tilt }) => (
            <li key={t}>
              <Sheet className="h-full px-5 pb-6 pt-5" tilt={tilt}>
                <span aria-hidden className="mx-auto mb-3 block h-3 w-3 rounded-full bg-desk ring-1 ring-line" />
                <Icon className="size-12 text-ink" />
                <h3 className="mt-3 font-display text-2xl font-semibold">{t}</h3>
                <p className="mt-1 text-ink-2">{d}</p>
              </Sheet>
            </li>
          ))}
        </ul>
        <p className="mt-10 max-w-3xl text-lg leading-relaxed">
          <strong>No wallet needed to spend.</strong> Give a certificate as a link or QR. The holder sets a PIN and pays
          by showing a QR. No wallet, no crypto, no gas. Only the giver needs USDC, and unused balance returns to the
          giver.
        </p>
      </Chapter>

      <Chapter id="developers" n={6} eyebrow="For developers" title="A few lines to buy. A few lines to sell.">
        <CodeTabs
          tabs={[
            { label: 'Buy (agent)', code: BUY },
            { label: 'Sell (API)', code: SELL },
          ]}
        />
      </Chapter>

      <section aria-labelledby="honest-title" className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <div className="mx-auto w-fit">
          <SealLogo size={72} />
        </div>
        <h2
          id="honest-title"
          className="mt-8 font-display text-4xl font-semibold leading-tight text-balance sm:text-5xl"
        >
          We removed offline cash. <em className="text-seal">We only ship what the math guarantees.</em>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
          We started out building offline cash. Our own adversarial review proved software alone can’t stop someone
          paying two offline strangers with the same money, so we removed it.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/demo">Watch an agent pay →</ButtonLink>
          <ButtonLink href="/guarantees" variant="secondary">
            Read the guarantees
          </ButtonLink>
        </div>
      </section>
    </>
  )
}
