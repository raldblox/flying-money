import { IconAgent, IconBowl, IconIssue, IconRedeem, IconSeal, IconServe } from '@/components/art/ink-icons'
import { CodeTabs } from '@/components/code-tabs'
import { DEMO_CARDS } from '@/components/demo/more-demos'
import { Hero } from '@/components/hero'
import { ButtonLink, Section, Sheet } from '@/components/section'
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

const STEPS: Array<Omit<ExplorerStep, 'icon'> & { Icon: typeof IconIssue }> = [
  {
    flow: 0,
    Icon: IconIssue,
    t: 'Fund',
    d: 'Set aside USDC for one seller and one spending key, with an amount and an end date. Funding happens online; network fees apply.',
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
    d: 'After checking the funded budget online, the seller can verify its signed slips locally, even without internet access.',
  },
  {
    flow: 3,
    Icon: IconRedeem,
    t: 'Collect',
    d: 'The seller returns online and collects before the end date. After expiry, the funder can reclaim what remains on-chain.',
  },
]

const textLink =
  'inline-flex min-h-11 items-center rounded font-medium text-indigo underline decoration-indigo/40 underline-offset-4 hover:decoration-indigo focus-visible:outline-2 focus-visible:outline-indigo'

export default function Home() {
  return (
    <>
      <Hero />
      <Section id="demos" eyebrow="Try it · we supply the test funds" title="Three ways to feel it work.">
        <p className="-mt-3 mb-7 max-w-2xl text-lg text-ink-2">
          Each demo gives you a part to play, a real payment on a test network, and a result you can inspect. No wallet
          to connect, nothing to install.
        </p>
        <ul className="grid gap-6 lg:grid-cols-3">
          {DEMO_CARDS.map(({ id, href, eyebrow, title, text, Icon, steps, cta, accent }) => (
            <li key={id}>
              <Sheet as="article" className={`flex h-full flex-col border-t-4 p-6 ${accent}`}>
                <div className="flex items-center justify-between gap-4">
                  <p className="smallcaps text-xs text-ink-2">{eyebrow}</p>
                  <Icon className="size-10 shrink-0 text-ink" />
                </div>
                <h3 className="mt-4 font-display text-3xl font-semibold">{title}</h3>
                <p className="mt-2 text-ink-2">{text}</p>
                <ol className="my-5 grid gap-2 border-y border-line py-4 text-sm" aria-label="What to expect">
                  {steps.map((step, i) => (
                    <li key={step} className="flex gap-3">
                      <span className="font-mono text-xs text-seal">{String(i + 1).padStart(2, '0')}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <div className="mt-auto">
                  <ButtonLink href={href}>{cta} →</ButtonLink>
                </div>
              </Sheet>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-ink-2">
          The demos need a connection to start and sponsor funds to be available; each one checks before it begins.
        </p>
      </Section>

      <Section id="how" eyebrow="The same idea behind both demos" title="Set money aside. Let the payment travel.">
        <p className="-mt-3 mb-8 max-w-3xl text-lg text-ink-2">
          The spending key signs payments; it does not get access to the funder’s wallet. Each budget is limited to one
          seller, one spending key, an amount and an end date.
        </p>
        <StepExplorer steps={STEPS.map(({ Icon, ...s }) => ({ ...s, icon: <Icon /> }))} cast="agents" />
        <div id="carriers" className="mt-8 border-y border-line py-6">
          <h3 className="font-display text-2xl font-semibold">How can a payment travel without internet?</h3>
          <div className="mt-4 max-w-3xl space-y-4 text-ink-2">
            <p>
              A payment slip contains a budget reference, a running total and a signature in about 150 bytes. The seller
              verifies the same proof whether it arrives by QR code, sound, a link or a local connection.
            </p>
            <ul className="grid gap-2 sm:grid-cols-2" aria-label="Available payment carriers">
              {CARRIERS_NOW.map((c) => (
                <li key={c.name}>
                  <strong className="text-ink">{c.name}</strong> — {c.hint}
                </li>
              ))}
            </ul>
            <p className="text-sm">Planned: {CARRIERS_NEXT.map((c) => c.name).join(', ')}.</p>
            <p>
              Funding and initial budget verification need internet. A seller must collect on-chain before expiry.
              Accepting a previously unseen budget offline carries a separate risk.
            </p>
            <a className={textLink} href="/docs/offline">
              Read the offline requirements →
            </a>
          </div>
        </div>
      </Section>

      <Section id="guarantees" eyebrow="Control has clear boundaries" title="Know what you’re approving.">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="font-display text-2xl font-semibold">You choose the limits up front.</h3>
            <ul className="mt-4 grid gap-4 text-ink-2">
              <li>
                <strong className="text-ink">One seller.</strong> The spending key cannot redirect the budget to another
                recipient.
              </li>
              <li>
                <strong className="text-ink">A fixed ceiling.</strong> It cannot collect more than the funded amount.
              </li>
              <li>
                <strong className="text-ink">An end date.</strong> The seller must collect before expiry. The funder can
                then reclaim the remaining on-chain balance.
              </li>
            </ul>
          </div>
          <Sheet as="aside" className="p-6 sm:p-8">
            <h3 className="font-display text-2xl font-semibold">A budget is a commitment.</h3>
            <p className="mt-3 text-ink-2">
              You cannot cancel it early. Keeping the money available is what lets the seller accept valid slips
              offline.
            </p>
            <p className="mt-3 text-ink-2">
              A stolen spending key can still spend the remaining budget with its allowed seller. Limits contain that
              risk; they do not remove it.
            </p>
            <p className="mt-3 text-ink-2">
              Flying Money does not guarantee delivery, timely collection, or that USDC will never be frozen. The code
              is not yet audited.
            </p>
            <a className={`${textLink} mt-3`} href="/guarantees">
              Read the promises and limits →
            </a>
          </Sheet>
        </div>
      </Section>

      <Section id="developers" eyebrow="Take it further" title="From a demo to your own budget.">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="font-display text-2xl font-semibold">For people and shops</h3>
            <p className="mt-3 text-ink-2">
              Give someone a budget, connect your assistant, spend a budget you received, or set up a shop till. Choose
              your role for a guided setup.
            </p>
            <div className="mt-5">
              <ButtonLink href="/start">Get started →</ButtonLink>
            </div>
          </div>
          <div>
            <h3 className="font-display text-2xl font-semibold">For developers</h3>
            <p className="mt-3 text-ink-2">
              Add paid requests to an agent with the client SDK, accept payments with seller middleware, or connect an
              assistant through MCP.
            </p>
            <div className="mt-3 flex flex-wrap gap-x-5">
              <a className={textLink} href="/docs/agents">
                Build an agent →
              </a>
              <a className={textLink} href="/docs/server">
                Build a seller →
              </a>
            </div>
          </div>
        </div>
        <details className="mt-8 border-y border-line py-5">
          <summary className="cursor-pointer rounded font-display text-2xl font-semibold focus-visible:outline-2 focus-visible:outline-indigo">
            See the SDK and MCP examples
          </summary>
          <div className="mt-6">
            <CodeTabs
              tabs={[
                { label: 'Pay (agent)', code: PAY },
                { label: 'Charge (API)', code: CHARGE },
                { label: 'Assistant (MCP)', code: MCP },
              ]}
            />
          </div>
        </details>
        <div id="story" className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="smallcaps text-xs text-seal">Inspired by the original flying money</p>
            <p className="mt-1 font-display text-2xl">Carry the proof. Leave the coins behind.</p>
          </div>
          <a href="/story" className={textLink}>
            Discover the story behind the name →
          </a>
        </div>
      </Section>
    </>
  )
}
