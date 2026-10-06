import {
  IconAgent,
  IconBowl,
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
import { Hero } from '@/components/hero'
import { ButtonLink, Chapter, Sheet } from '@/components/section'
import { type ExplorerStep, StepExplorer } from '@/components/step-explorer'
import { CARRIERS_NEXT, CARRIERS_NOW } from '@/lib/carry/carriers'

const PAY = `import { createFlyingMoneyClient, fileStore } from '@flying-money/client'
import { privateKeyToAccount } from 'viem/accounts'

const fm = createFlyingMoneyClient({
  chains: ['arbitrum-sepolia', 'base-sepolia', 'ethereum-sepolia', 'tempo-testnet'],
  spender: privateKeyToAccount(process.env.AGENT_KEY),
  store: fileStore('.flying-money.json'),         // crash-safe outbox
  certificates: [process.env.AGENT_CERTIFICATES],  // the budget your owner funded
  maxPricePerRequest: 50_000n,                     // 0.05 USDC
})
const res = await fm.fetch('https://flying-money-oracle.vercel.app/v1/tea-price?city=Luoyang')`

const CHARGE = `import { flyingMoney } from '@flying-money/server/hono'
import { upstashStore } from '@flying-money/server'

app.use('/v1/*', flyingMoney({
  accepts: ['arbitrum-sepolia', 'base-sepolia', 'ethereum-sepolia', 'tempo-testnet'],
  payee: process.env.PAYEE_ADDRESS,
  price: () => 10_000n,                            // 0.01 USDC per request
  store: upstashStore({ url, token }),             // durable, shared state
}))
app.get('/v1/tea-price', (c) => c.json({ price: 42 }))`

const MCP = `{
  "mcpServers": {
    "flying-money": {
      "command": "npx",
      "args": ["-y", "@flying-money/mcp"],
      "env": { "FM_OWNER": "0xYourWallet" }
    }
  }
}`

const PROBLEMS: Array<[string, string]> = [
  ['A card or an API key.', 'It needs the network for every payment, and one leak has no ceiling.'],
  ['A blockchain transaction per payment.', 'Each one waits for the network and can cost more than what it pays for.'],
  ['Pay later, on trust.', 'A seller has no reason to trust an agent or a robot it has never met.'],
]

const STEPS: Array<Omit<ExplorerStep, 'icon'> & { Icon: typeof IconIssue }> = [
  {
    flow: 0,
    Icon: IconIssue,
    t: 'Fund',
    d: 'Choose a seller, an amount and an end date. The money is set aside for that seller alone, from your wallet.',
  },
  {
    flow: 1,
    Icon: IconSeal,
    t: 'Pay',
    d: 'The agent, phone or robot pays with a signed slip, about 150 bytes, by QR code, sound, a link or HTTP.',
  },
  {
    flow: 2,
    Icon: IconServe,
    t: 'Check',
    d: 'The seller checks the slip on the spot, with no internet needed, and serves, sure the money is there.',
  },
  {
    flow: 3,
    Icon: IconRedeem,
    t: 'Collect',
    d: 'Back online, the seller collects in one transaction. After the end date, you take back what’s left.',
  },
]

const USES = [
  {
    Icon: IconAgent,
    t: 'Local AI',
    d: 'A model on your laptop pays a tool on the same Wi-Fi, from a budget it can’t raise.',
  },
  {
    Icon: IconAgent,
    t: 'Claude with a budget',
    d: 'Your assistant asks for a budget; you approve it from your wallet.',
  },
  {
    Icon: IconBowl,
    t: 'Counters with bad signal',
    d: 'A canteen or market stall takes payments in a dead zone, face to face or over its own Wi-Fi.',
  },
  {
    Icon: IconWorker,
    t: 'Robots and drones',
    d: 'A robot pays a charger or a door, and syncs when it docks.',
    soon: true,
  },
  {
    Icon: IconTea,
    t: 'Vending machines',
    d: 'A machine with a screen and a speaker takes slips by QR code or sound, offline.',
    soon: true,
  },
  { Icon: IconWorker, t: 'Field staff', d: 'Fuel money for one station, with no company card to lose.' },
]

export default function Home() {
  return (
    <>
      <Hero />

      <Chapter id="problem" n={1} eyebrow="The problem" title="Every payment asks a server for permission.">
        <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-center">
          <Sheet className="px-6 py-6 sm:px-10" tilt={-0.6}>
            <p className="smallcaps text-sm text-ink-2">Ways to let a machine pay</p>
            <ol className="mt-3 grid gap-5">
              {PROBLEMS.map(([q, why]) => (
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
              Carry a <em className="text-seal">budget</em> instead: money set aside for one seller, spent with slips
              that need no connection.
            </p>
          </Sheet>
          <p className="text-xl leading-relaxed text-ink-2">
            Models now run on laptops. Robots work where the Wi-Fi drops. Counters sit in dead zones. Payments are the
            one thing that still stops when the connection does, and letting a machine pay at all still means handing it
            your wallet.
          </p>
        </div>
      </Chapter>

      <Chapter id="how" n={2} eyebrow="How it works" title="Four steps. Your wallet stays out of it.">
        <StepExplorer steps={STEPS.map(({ Icon, ...s }) => ({ ...s, icon: <Icon /> }))} cast="agents" />
      </Chapter>

      <Chapter id="carriers" n={3} eyebrow="Any carrier" title="Anything that carries 150 bytes carries money.">
        <p className="-mt-4 mb-6 max-w-3xl text-lg text-ink-2">
          A payment is a signed slip: the budget, the running total and a signature. It doesn’t care how it travels, and
          the seller checks it the same way every time.
        </p>
        <div className="mb-6 grid gap-4 md:grid-cols-2">
          <Sheet className="p-5">
            <p className="smallcaps text-xs text-seal">At the counter</p>
            <h3 className="mt-1 font-display text-2xl font-semibold">Face to face</h3>
            <p className="mt-2 text-ink-2">
              Hold the phone up to the till. Each screen shows a code and reads the other’s: the price goes one way, the
              slip the other, the receipt comes back. The buyer only enters a PIN. No internet on either side.
            </p>
          </Sheet>
          <Sheet className="p-5">
            <p className="smallcaps text-xs text-seal">Shops with Wi-Fi</p>
            <h3 className="mt-1 font-display text-2xl font-semibold">The local network</h3>
            <p className="mt-2 text-ink-2">
              A seller announces itself on the shop’s Wi-Fi, the way a printer does. Agents, phones and devices on the
              same network find it and pay it, with no internet and no app store, server or registry in between.
            </p>
          </Sheet>
        </div>
        <ul className="flex flex-wrap gap-2" aria-label="Carriers you can use today">
          {CARRIERS_NOW.map((c) => (
            <li
              key={c.name}
              title={c.hint}
              className="rounded-full border border-ink bg-ink px-4 py-2 text-sm text-paper"
            >
              {c.name}
            </li>
          ))}
        </ul>
        <ul className="mt-3 flex flex-wrap gap-2" aria-label="Carriers coming next">
          {CARRIERS_NEXT.map((c) => (
            <li
              key={c.name}
              title={c.hint}
              className="rounded-full border border-dashed border-ink/40 px-4 py-2 text-sm text-ink-2"
            >
              {c.name} <span className="smallcaps text-[0.65rem]">soon</span>
            </li>
          ))}
        </ul>
        <p className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <a className="font-medium text-indigo underline" href="/demo/slip">
            Carry a real slip between two devices →
          </a>
          <a className="font-medium text-indigo underline" href="/docs/offline">
            Offline and local payments →
          </a>
          <a className="font-medium text-indigo underline" href="/docs/protocol">
            The slip format →
          </a>
        </p>
      </Chapter>

      <Chapter id="guarantees" n={4} eyebrow="Trust" title="What’s protected, and what isn’t.">
        <Sheet className="overflow-hidden">
          <div className="grid md:grid-cols-2">
            <div className="p-6 sm:p-10">
              <h3 className="font-display text-2xl font-semibold">
                <span className="text-seal">✓</span> Protected
              </h3>
              <ul className="mt-3 grid gap-3">
                <li>
                  The payer can’t pay more than the budget. A stolen key can spend at most what’s left, and only at that
                  one seller.
                </li>
                <li>Every valid slip is backed by money set aside for that seller until the end date.</li>
                <li>
                  A seller that has checked a budget once can accept its slips with no internet, and be sure of the
                  money.
                </li>
                <li>After the end date, whoever put the money in can take back what wasn’t spent.</li>
              </ul>
            </div>
            <div className="border-t border-dashed border-seal/40 p-6 sm:p-10 md:border-l md:border-t-0">
              <h3 className="font-display text-2xl font-semibold text-ink-2">Not protected</h3>
              <ul className="mt-3 grid gap-3 text-ink-2">
                <li>A budget the seller has never seen, accepted offline: that’s the seller’s own risk, capped.</li>
                <li>That the seller delivers what was paid for, or collects before the end date.</li>
                <li>That the USDC issuer never freezes funds.</li>
                <li>That the code is free of bugs. It is test software and has not been audited.</li>
              </ul>
            </div>
          </div>
        </Sheet>
        <p className="mt-6 max-w-3xl text-ink-2">
          <strong className="text-ink">Why there’s no cancel button:</strong> a seller can accept a slip on the spot,
          even offline, only because the money can’t be pulled back halfway through. You control where, how much and how
          long, and whether to renew.{' '}
          <a href="/guarantees" className="font-medium text-indigo underline decoration-indigo/40 underline-offset-4">
            Read the full guarantees →
          </a>
        </p>
      </Chapter>

      <Chapter id="uses" n={5} eyebrow="Who it’s for" title="Anything that pays, anywhere it is.">
        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {USES.map(({ Icon, t, d, soon }) => (
            <li key={t}>
              <Sheet className="flex h-full gap-4 p-5">
                <Icon className="size-11 shrink-0 text-ink" />
                <div>
                  <h3 className="font-display text-2xl font-semibold">
                    {t}
                    {soon && <span className="smallcaps ml-2 align-middle text-xs text-ink-2">soon</span>}
                  </h3>
                  <p className="mt-1 text-ink-2">{d}</p>
                </div>
              </Sheet>
            </li>
          ))}
        </ul>
      </Chapter>

      <Chapter id="developers" n={6} eyebrow="For developers" title="A few lines to pay. A few lines to charge.">
        <p className="-mt-4 mb-6 max-w-3xl text-lg text-ink-2">
          Your agent uses a drop-in <code className="font-mono text-base">fetch</code> that answers HTTP 402 “Payment
          Required” by itself (and speaks x402). Your API adds one middleware, checks every payment on its own server,
          and collects in batches. Assistants connect through the MCP server with one setting.
        </p>
        <CodeTabs
          tabs={[
            { label: 'Pay (agent)', code: PAY },
            { label: 'Charge (API)', code: CHARGE },
            { label: 'Assistant (MCP)', code: MCP },
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

      <Chapter id="story" n={7} eyebrow="Why “flying money”" title="Money that flies, since 804.">
        <Sheet as="article" className="px-6 py-8 sm:px-12 sm:py-10">
          <p className="max-w-3xl text-lg leading-relaxed">
            In Tang-dynasty China, tea merchants were tired of hauling heavy strings of coin. They deposited the coin at
            an official office and travelled with a certificate that paid out when its tallies matched. People called it{' '}
            <span lang="zh-Hant" className="font-han text-seal">
              飛錢
            </span>
            , <em className="font-display text-2xl">flying money</em>. We use the same idea: put the money aside first,
            carry a proof instead, settle later. Today the proof is a slip of about 150 bytes, and it flies by QR code,
            sound or a link.
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
          Pay with your phone in airplane mode. <em className="text-seal">Watch it settle later.</em>
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-ink-2">
          Real transactions on a test network: the till accepts your slip with no internet, then collects in one
          transaction when it’s back online.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/demo/counter">Try the offline counter →</ButtonLink>
          <ButtonLink href="/demo" variant="secondary">
            Watch an agent pay
          </ButtonLink>
        </div>
      </section>
    </>
  )
}
