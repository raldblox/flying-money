import { getChain } from '@flying-money/chains'
import type { Metadata } from 'next'
import { AddressPill } from '@/components/address-pill'
import { ButtonLink } from '@/components/section'

export const metadata: Metadata = {
  title: 'Arbitrum Open House',
  description: 'Flying Money for the Arbitrum Open House Singapore buildathon: one primitive, two front doors.',
}

export default function ArbitrumPage() {
  const sepolia = getChain('arbitrum-sepolia')
  const one = getChain('arbitrum')
  return (
    <article className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-seal">
        Arbitrum Open House Singapore · buildathon
      </p>
      <h1 className="mt-2 font-display text-5xl font-semibold leading-tight tracking-tight text-balance">
        A novel financial product: one primitive, two front doors.
      </h1>
      <p className="mt-6 text-lg leading-relaxed text-ink-2">
        Flying Money is chain-agnostic; this submission is deployed and demoed on Arbitrum. A funder locks USDC for{' '}
        <em>one</em> seller, spendable by <em>one</em> key, until a date. The holder pays with signed notes the seller
        verifies instantly, even offline, and the seller settles everything in one transaction.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        <section className="rounded-lg border border-line bg-paper-2 p-6" aria-labelledby="shops">
          <h2 id="shops" className="font-display text-2xl font-semibold">
            For people & shops
          </h2>
          <p className="mt-2 text-ink-2">
            Tabs, allowances and gift certificates. A parent funds a canteen certificate; the child pays with a QR code;
            the till accepts it even with the Wi‑Fi off; the canteen collects the day’s notes in one transaction.
          </p>
          <p className="mt-3 text-sm text-ink-2">Shop mode is being built for this submission.</p>
        </section>
        <section className="rounded-lg border border-line bg-paper-2 p-6" aria-labelledby="agents">
          <h2 id="agents" className="font-display text-2xl font-semibold">
            For agents
          </h2>
          <p className="mt-2 text-ink-2">
            An AI agent buys data from a paid API over HTTP 402 with sealed notes: the budget is enforced by the
            certificate, not the prompt. Twenty paid calls settle in a few transactions.
          </p>
          <div className="mt-4">
            <ButtonLink href="/demo">Run the live demo</ButtonLink>
          </div>
        </section>
      </div>

      <h2 className="mt-12 font-display text-3xl font-semibold">Deployments on Arbitrum</h2>
      <dl className="mt-4 space-y-4">
        <div>
          <dt className="text-sm text-ink-2">Arbitrum Sepolia (testnet, uncapped)</dt>
          <dd className="mt-1">
            {sepolia.flyingMoney ? (
              <AddressPill
                value={sepolia.flyingMoney}
                href={`${sepolia.explorer}/address/${sepolia.flyingMoney}`}
                label="contract"
              />
            ) : (
              'deploying'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-ink-2">
            Arbitrum One (mainnet, capped: 100 USDC per certificate · 1,000 USDC deployment-wide)
          </dt>
          <dd className="mt-1">
            {one.flyingMoney ? (
              <AddressPill
                value={one.flyingMoney}
                href={`${one.explorer}/address/${one.flyingMoney}`}
                label="contract"
              />
            ) : (
              <span className="text-ink-2">Not deployed yet. It will be deployed, capped, before submission.</span>
            )}
          </dd>
        </div>
      </dl>

      <h2 className="mt-12 font-display text-3xl font-semibold">Why this is a novel financial product</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-lg text-ink-2">
        <li>A prefunded, payee-scoped, expiring allowance: capped for the holder, reserved for the shop.</li>
        <li>Cumulative signed notes: any number of payments, one redemption.</li>
        <li>Anyone can redeem, so sellers and relayers need no special role; value only reaches the payee.</li>
        <li>No token, no points, no airdrop. Settlement is Circle USDC.</li>
        <li>Invariant-tested contract; unaudited; mainnet exposure bounded by immutable caps.</li>
      </ul>

      <h2 className="mt-12 font-display text-3xl font-semibold">What was built during the event</h2>
      <p className="mt-4 text-lg text-ink-2">
        The whole codebase is a rebuild started on 23 September 2026. The earlier prototype was archived and is not part
        of this submission.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/guarantees" variant="secondary">
          Guarantees
        </ButtonLink>
        <ButtonLink href="/chains" variant="secondary">
          All deployments
        </ButtonLink>
      </div>
      <p className="mt-10 text-sm text-ink-2">Demo video: coming before submission.</p>
    </article>
  )
}
