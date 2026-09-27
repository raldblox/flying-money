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
import { BrandMark } from '@/components/brand-mark'
import { CodeTabs } from '@/components/code-tabs'
import { DoorOnly, DoorProvider } from '@/components/door'
import { Hero } from '@/components/hero'
import { ButtonLink, Chapter, Sheet } from '@/components/section'
import { type ExplorerStep, StepExplorer } from '@/components/step-explorer'

const PAY = `import { createFlyingMoneyClient, fileStore } from '@flying-money/client'
import { privateKeyToAccount } from 'viem/accounts'

const fm = createFlyingMoneyClient({
  chains: ['arbitrum-sepolia'],
  spender: privateKeyToAccount(process.env.AGENT_KEY),
  store: fileStore('.flying-money.json'),         // crash-safe outbox
  certificates: [process.env.AGENT_CERTIFICATES],  // the budget your owner funded
  maxPricePerRequest: 50_000n,                     // 0.05 USDC
})
const res = await fm.fetch('https://oracle.example/v1/tea-price?city=Luoyang')`

const CHARGE = `import { flyingMoney } from '@flying-money/server/hono'
import { upstashStore } from '@flying-money/server'

app.use('/v1/*', flyingMoney({
  accepts: ['arbitrum-sepolia'],
  payee: process.env.PAYEE_ADDRESS,
  price: () => 10_000n,                            // 0.01 USDC per request
  store: upstashStore({ url, token }),             // durable, shared state
}))
app.get('/v1/tea-price', (c) => c.json({ price: 42 }))`

const MCP = `{
  "mcpServers": {
    "flying-money": {
      "command": "node",
      "args": ["flying-money/packages/mcp/dist/bin.js"],
      "env": {
        "AGENT_KEY": "0x…",
        "AGENT_CERTIFICATES": "0x…",
        "FM_MAX_PRICE": "0.05"
      }
    }
  }
}`

type Door = 'agents' | 'people'

const PROBLEMS: Record<Door, Array<[string, string]>> = {
  agents: [
    ['Give it your card.', 'One bad loop or one prompt injection, and there’s no ceiling on the bill.'],
    [
      'Pay on the blockchain for every call.',
      'Each payment waits for a transaction and costs more than the call itself.',
    ],
    ['Pay later on trust.', 'A seller has no reason to trust an agent it has never met.'],
  ],
  people: [
    ['Cash.', 'It gets lost, spent elsewhere, and you never see where it went.'],
    ['A spare card.', 'It works everywhere, so the limit is only a promise.'],
    ['A shop’s own prepaid card.', 'One plastic card, one app, one sign-up per shop.'],
  ],
}

const STEPS: Record<Door, Array<Omit<ExplorerStep, 'icon'> & { Icon: typeof IconIssue }>> = {
  agents: [
    {
      flow: 0,
      Icon: IconIssue,
      t: 'Fund',
      d: 'Pick a service, an amount and an end date. The money is set aside for that service alone.',
    },
    {
      flow: 1,
      Icon: IconSeal,
      t: 'Pay',
      d: 'Your agent pays for each request with a signed slip. No transaction, no fee, no waiting.',
    },
    {
      flow: 2,
      Icon: IconServe,
      t: 'Serve',
      d: 'The service checks the slip in milliseconds and answers straight away.',
    },
    {
      flow: 3,
      Icon: IconRedeem,
      t: 'Collect',
      d: 'The service collects what it earned in one go. After the end date, you take back what’s left.',
    },
  ],
  people: [
    {
      flow: 0,
      Icon: IconIssue,
      t: 'Give',
      d: 'Choose the place, the amount and the end date. Send it to Mia as a link or a QR code.',
    },
    {
      flow: 1,
      Icon: IconSeal,
      t: 'Pay',
      d: 'At the counter, the till shows the price. Mia scans it, enters her PIN, and shows her payment code.',
    },
    {
      flow: 2,
      Icon: IconServe,
      t: 'Accept',
      d: 'The till checks the code in milliseconds, even for returning customers when the shop’s Wi‑Fi is down.',
    },
    {
      flow: 3,
      Icon: IconRedeem,
      t: 'Collect',
      d: 'The shop collects the day’s payments in one transfer. After the end date, you take back the leftovers.',
    },
  ],
}

const USES = [
  { Icon: IconAgent, t: 'Research agent', d: '5 USDC for one data API, this week. It stops at 5.00.' },
  { Icon: IconAgent, t: 'Claude with a budget', d: 'Let Claude call paid tools inside a limit it can’t raise.' },
  { Icon: IconBowl, t: 'School lunch', d: '50 USDC at the school canteen, this term.' },
  { Icon: IconTea, t: 'Morning coffee', d: '20 USDC at your usual café. No fee for you.' },
  { Icon: IconWorker, t: 'Field staff', d: 'Fuel money for one station, with no company card to lose.' },
  {
    Icon: IconGift,
    t: 'A gift for one shop',
    d: 'Sent as a link. Whatever isn’t spent returns to the sender after the end date.',
  },
]

function Problem({ door }: { door: Door }) {
  return (
    <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
      <Sheet className="px-6 py-6 sm:px-10" tilt={-0.6}>
        <p className="smallcaps text-sm text-ink-2">
          {door === 'agents' ? 'Ways to let an agent pay' : 'Ways to hand over money'}
        </p>
        <ol className="mt-3 grid gap-5">
          {PROBLEMS[door].map(([q, why]) => (
            <li key={q}>
              {/* a real strikethrough, so it follows every wrapped line on small screens */}
              <span className="font-display text-2xl font-semibold text-ink-2 line-through decoration-seal/85 decoration-2">
                {q}
              </span>
              <span className="mt-1 block text-ink-2">{why}</span>
            </li>
          ))}
        </ol>
        <p className="mt-6 border-t border-line pt-5 font-display text-2xl font-semibold leading-snug sm:text-3xl">
          {door === 'agents' ? (
            <>
              Give it a <em className="text-seal">budget</em> instead: one service, one amount, one end date.
            </>
          ) : (
            <>
              Money for <em className="text-seal">one place</em>, with a limit that holds and leftovers you take back.
            </>
          )}
        </p>
      </Sheet>
      <p className="text-xl leading-relaxed text-ink-2">
        {door === 'agents'
          ? 'Agents buy API calls, data and compute thousands of times a day, for fractions of a cent. The limit has to live outside the prompt, because prompts can be hijacked.'
          : 'A parent, an employer or a friend wants to hand over money for one thing, without handing over a card. The shop wants to be sure the money is really there.'}
      </p>
    </div>
  )
}

function Steps({ door }: { door: Door }) {
  return <StepExplorer steps={STEPS[door].map(({ Icon, ...s }) => ({ ...s, icon: <Icon /> }))} cast={door} />
}

function ProblemTitle() {
  return (
    <>
      <DoorOnly inline door="agents">
        Your agent needs to pay. Every way to let it is bad.
      </DoorOnly>
      <DoorOnly inline door="people">
        Handing over money for one thing shouldn’t mean handing over your card.
      </DoorOnly>
    </>
  )
}

export default function Home() {
  return (
    <DoorProvider>
      <Hero />

      <Chapter id="problem" n={1} eyebrow="The problem" title={<ProblemTitle />}>
        <DoorOnly door="agents">
          <Problem door="agents" />
        </DoorOnly>
        <DoorOnly door="people">
          <Problem door="people" />
        </DoorOnly>
      </Chapter>

      <Chapter id="how" n={2} eyebrow="How it works" title="Four steps. Your wallet stays out of it.">
        <DoorOnly door="agents">
          <Steps door="agents" />
        </DoorOnly>
        <DoorOnly door="people">
          <Steps door="people" />
        </DoorOnly>
      </Chapter>

      <Chapter id="guarantees" n={3} eyebrow="Trust" title="What’s protected, and what isn’t.">
        <Sheet className="overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="p-6 sm:p-10">
              <h3 className="font-display text-2xl font-semibold">
                <span className="text-seal">✓</span> Protected
              </h3>
              <ul className="mt-3 grid gap-3">
                <li>
                  The spender can’t pay more than the budget. A stolen key can spend at most what’s left, and only at
                  that one place.
                </li>
                <li>Every valid payment slip is backed by money set aside for that seller until the end date.</li>
                <li>Anyone can submit a slip for collection, but the money only ever goes to the named seller.</li>
                <li>After the end date, whoever put the money in can take back what wasn’t spent.</li>
              </ul>
            </div>
            <div className="border-t border-dashed border-seal/40 p-6 sm:p-10 md:border-l md:border-t-0">
              <h3 className="font-display text-2xl font-semibold text-ink-2">Not protected</h3>
              <ul className="mt-3 grid gap-3 text-ink-2">
                <li>That the seller delivers what was paid for.</li>
                <li>That the seller collects before the end date. (Our seller software does this automatically.)</li>
                <li>That the USDC issuer never freezes funds.</li>
                <li>That the code is free of bugs. It is test software and has not been audited.</li>
              </ul>
            </div>
          </div>
        </Sheet>
        <p className="mt-6 max-w-3xl text-ink-2">
          <strong className="text-ink">Why there’s no cancel button:</strong> a shop can accept a payment on the spot,
          even offline, only because the money can’t be pulled back halfway through. You control where, how much and how
          long, and whether to renew.{' '}
          <a href="/guarantees" className="font-medium text-indigo underline decoration-indigo/40 underline-offset-4">
            Read the full guarantees →
          </a>
        </p>
      </Chapter>

      <Chapter id="uses" n={4} eyebrow="Use cases" title="One idea, many kinds of spending.">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {USES.map(({ Icon, t, d }) => (
            <li key={t}>
              <Sheet className="flex h-full gap-4 p-5">
                <Icon className="size-11 shrink-0 text-ink" />
                <div>
                  <h3 className="font-display text-2xl font-semibold">{t}</h3>
                  <p className="mt-1 text-ink-2">{d}</p>
                </div>
              </Sheet>
            </li>
          ))}
        </ul>
      </Chapter>

      <Chapter id="developers" n={5} eyebrow="For developers" title="A few lines to pay. A few lines to charge.">
        <p className="-mt-4 mb-6 max-w-3xl text-lg text-ink-2">
          Your agent uses a drop-in <code className="font-mono text-base">fetch</code> that answers HTTP 402 “Payment
          Required” by itself. Your API adds one middleware, checks every payment on its own server, and collects in
          batches of up to 20.
        </p>
        <CodeTabs
          tabs={[
            { label: 'Pay (agent)', code: PAY },
            { label: 'Charge (API)', code: CHARGE },
            { label: 'Claude (MCP)', code: MCP },
          ]}
        />
        <p className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <a className="font-medium text-indigo underline" href="/docs/agents">
            Agent quickstart →
          </a>
          <a className="font-medium text-indigo underline" href="/docs/server">
            Seller quickstart →
          </a>
          <a className="font-medium text-indigo underline" href="/llms.txt">
            llms.txt for your agent →
          </a>
        </p>
      </Chapter>

      <Chapter id="story" n={6} eyebrow="Why “flying money”" title="Named after an idea from 804.">
        <Sheet as="article" className="px-6 py-8 sm:px-12 sm:py-10">
          <p className="max-w-3xl text-lg leading-relaxed">
            In Tang-dynasty China, tea merchants were tired of hauling heavy strings of coin. They deposited the coin at
            an official office and travelled with a certificate that paid out when its tallies matched. People called it{' '}
            <span lang="zh-Hant" className="font-han text-seal">
              飛錢
            </span>
            , <em className="font-display text-2xl">flying money</em>. We use the same idea: put the money aside first,
            carry a proof instead, settle later.
          </p>
          <SilkRoadMap className="mt-8 w-full" />
          <p className="mt-4 text-sm">
            <a className="font-medium text-indigo underline" href="/story">
              Read the story →
            </a>
          </p>
        </Sheet>
      </Chapter>

      <section aria-labelledby="close-title" className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <div className="mx-auto w-fit">
          <BrandMark size={96} />
        </div>
        <h2
          id="close-title"
          className="mt-8 font-display text-4xl font-semibold leading-tight text-balance sm:text-5xl"
        >
          Watch an agent make 20 paid calls and settle them in <em className="text-seal">3 transactions.</em>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
          It runs live on a test network in about 30 seconds. Cut its connection. Steal its key. Watch what gets
          refused.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/demo">Run the live demo →</ButtonLink>
          <ButtonLink href="/docs" variant="secondary">
            Read the docs
          </ButtonLink>
        </div>
      </section>
    </DoorProvider>
  )
}
