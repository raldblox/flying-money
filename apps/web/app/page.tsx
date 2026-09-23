import { CodeTabs } from '@/components/code-tabs'
import { Hero } from '@/components/hero'
import { ButtonLink, Section } from '@/components/section'

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

export default function Home() {
  return (
    <>
      <Hero />
      <hr className="brush mx-auto max-w-6xl" />

      <Section id="story" eyebrow="804 CE" title="In 804 CE, merchants stopped carrying coins.">
        <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
          <p className="text-lg leading-relaxed text-ink-2">
            Tea merchants in Tang-dynasty China faced a shortage of copper coin and dangerous roads. So they deposited
            coin with an official office and carried a certificate instead, made of matching halves and redeemed in
            another city. People called it <span lang="zh-Hant">飛錢</span>: <em>flying money</em>. The value travelled;
            the coins stayed safe.
          </p>
          <ul className="space-y-2 text-sm text-ink-2">
            <li>
              Sources:{' '}
              <a className="text-indigo underline decoration-line" href="https://en.wikipedia.org/wiki/Flying_cash">
                Wikipedia, “Flying cash”
              </a>
            </li>
            <li>
              <a className="text-indigo underline decoration-line" href="https://www.britannica.com/topic/feiqian">
                Britannica, “Feiqian”
              </a>
            </li>
          </ul>
        </div>
      </Section>

      <Section id="problem" eyebrow="Today" title="AI agents have the same problem.">
        <ul className="grid gap-4 md:grid-cols-3">
          {[
            ['Give it your card?', 'Unbounded risk if it loops or gets hijacked.'],
            ['Pay on-chain per request?', 'Too slow and too costly at a tenth of a cent a call.'],
            ['Promise to pay later?', 'Sellers can’t trust an anonymous agent.'],
          ].map(([t, d]) => (
            <li key={t} className="rounded-lg border border-line bg-paper-2 p-6">
              <h3 className="font-display text-2xl font-semibold">{t}</h3>
              <p className="mt-2 text-ink-2">{d}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="how" eyebrow="How it works" title="Issue. Seal. Serve. Redeem.">
        <ol className="grid gap-6 md:grid-cols-4">
          {[
            ['Issue', 'Lock 5 USDC for one seller, usable by one agent key, until a date.'],
            ['Seal', 'Every request carries a signed note: “total so far: 0.37”.'],
            [
              'Serve',
              'The seller verifies the note locally in milliseconds. No transaction, no waiting. It keeps working even if the network blinks.',
            ],
            [
              'Redeem',
              'The seller redeems the latest note in one transaction. Leftover funds return to you after expiry.',
            ],
          ].map(([t, d], k) => (
            <li key={t} className="border-t-2 border-ink pt-4">
              <p className="font-mono text-sm text-seal">0{k + 1}</p>
              <h3 className="mt-1 font-display text-2xl font-semibold">{t}</h3>
              <p className="mt-2 text-ink-2">{d}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="guarantees" eyebrow="Guarantees" title="What the math guarantees, and what it doesn’t.">
        <div className="grid gap-8 md:grid-cols-2">
          <div>
            <h3 className="font-display text-2xl font-semibold">What’s guaranteed</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-2">
              <li>The spender can’t authorize beyond the face value, even with a stolen key.</li>
              <li>Every redeemable note is backed by funds reserved for that seller until expiry.</li>
              <li>Anyone can redeem, but the value only reaches the named seller.</li>
              <li>You get the remainder back after expiry.</li>
            </ul>
          </div>
          <div>
            <h3 className="font-display text-2xl font-semibold">What isn’t</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-ink-2">
              <li>That the seller delivers.</li>
              <li>That the seller redeems before expiry (its SDK does this automatically).</li>
              <li>Stablecoin freezes.</li>
              <li>This is unaudited testnet software.</li>
            </ul>
          </div>
        </div>
        <p className="mt-8">
          <a href="/guarantees" className="text-indigo underline decoration-line hover:decoration-indigo">
            Read the full guarantees and threat model →
          </a>
        </p>
      </Section>

      <Section id="people" eyebrow="Not only agents" title="Anyone who spends on your behalf.">
        <p className="max-w-3xl text-lg leading-relaxed text-ink-2">
          Anyone who spends on your behalf (an agent, a child, an employee, a friend with a gift) gets a certificate for
          one place, with a hard limit. Every note they sign is backed by money reserved for that shop.
        </p>
        <p className="mt-4 max-w-3xl text-lg leading-relaxed text-ink-2">
          <strong className="text-ink">No wallet needed to spend.</strong> Give your kid, employee or friend a
          certificate as a link or QR. They set a PIN and pay by showing a QR. No wallet, no crypto, no gas. Only the
          giver needs USDC. Unused balance returns to the giver.
        </p>
      </Section>

      <Section id="developers" eyebrow="For developers" title="Eight lines to buy. Eight lines to sell.">
        <CodeTabs
          tabs={[
            { label: 'Buy (agent)', code: BUY },
            { label: 'Sell (API)', code: SELL },
          ]}
        />
      </Section>

      <Section id="honest" eyebrow="Why we’re honest about offline" title="We removed offline cash.">
        <p className="max-w-3xl text-lg leading-relaxed text-ink-2">
          We started out building offline cash. Our own adversarial review proved software alone can’t stop someone
          paying two offline strangers with the same money, so we removed it. Flying Money only promises what the math
          guarantees.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <ButtonLink href="/demo">Watch an agent pay</ButtonLink>
          <ButtonLink href="/guarantees" variant="secondary">
            Guarantees
          </ButtonLink>
        </div>
      </Section>
    </>
  )
}
