import { getChain } from '@flying-money/chains'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AddressPill } from '@/components/address-pill'
import { ButtonLink, Sheet } from '@/components/section'
import { getHackathon, HACKATHONS } from '@/lib/hackathons'

export const dynamicParams = false

export function generateStaticParams() {
  return HACKATHONS.map((h) => ({ event: h.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ event: string }> }): Promise<Metadata> {
  const h = getHackathon((await params).event)
  return h ? { title: h.name, description: `Flying Money for ${h.name}: ${h.pitch}` } : {}
}

/** /hackathons/[event] (§16.2): one page per submission; only the framing and the default chains change. */
export default async function HackathonPage({ params }: { params: Promise<{ event: string }> }) {
  const h = getHackathon((await params).event)
  if (!h) notFound()
  const chains = h.chains.map(getChain)
  const deployed = chains.filter((c) => c.flyingMoney)
  const pending = chains.filter((c) => !c.flyingMoney)
  const names = (list: typeof chains) => list.map((c) => c.chain.name).join(' and ')
  // say only what is true today: deployed chains now, the rest as planned
  const where =
    pending.length === 0
      ? `is deployed and demoed on ${names(deployed)}`
      : deployed.length === 0
        ? `will be deployed and demoed on ${names(pending)}`
        : `is live on ${names(deployed)} and will be deployed on ${names(pending)}`

  const shops = (
    <Sheet as="section" className="p-6">
      <h2 className="font-display text-2xl font-semibold">For people & shops</h2>
      <p className="mt-2 text-ink-2">
        Tabs, allowances and gift certificates. A parent funds a café certificate; the child pays with a QR code; the
        till accepts it even with the Wi‑Fi off; the café collects the day’s payments in one transaction.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <ButtonLink href="/shops">See Shop mode</ButtonLink>
      </div>
    </Sheet>
  )
  const agents = (
    <Sheet as="section" className="p-6">
      <h2 className="font-display text-2xl font-semibold">For agents</h2>
      <p className="mt-2 text-ink-2">
        An AI agent buys data from a paid API over HTTP 402 with sealed notes, directly or through the MCP server. The
        budget is enforced by the certificate, not the prompt. Twenty paid calls settle in a few transactions.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <ButtonLink href="/demo">Run the live demo</ButtonLink>
        <ButtonLink href="/docs/mcp" variant="secondary">
          MCP server
        </ButtonLink>
      </div>
    </Sheet>
  )

  return (
    <article className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="smallcaps text-sm text-seal">
        {h.name} · {h.kind} · submission by {h.deadline}
      </p>
      <h1 className="mt-2 font-display text-5xl font-semibold leading-tight tracking-tight text-balance">{h.pitch}</h1>
      <p className="mt-6 text-lg leading-relaxed text-ink-2">
        Flying Money is chain-agnostic; this submission {where}. A funder locks USDC for <em>one</em> seller, spendable
        by <em>one</em> key, until a date. The holder pays with signed notes the seller verifies instantly, even
        offline, and the seller settles everything in one transaction.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {h.lead === 'shops' ? shops : agents}
        {h.lead === 'shops' ? agents : shops}
      </div>

      <h2 className="mt-12 font-display text-3xl font-semibold">Deployments for this submission</h2>
      <dl className="mt-4 space-y-4">
        {chains.map((c) => (
          <div key={c.key}>
            <dt className="text-sm text-ink-2">
              {c.chain.name}{' '}
              {c.mainnet
                ? '(mainnet, capped: 100 USDC per certificate · 1,000 USDC deployment-wide)'
                : '(testnet, uncapped)'}
            </dt>
            <dd className="mt-1">
              {c.flyingMoney ? (
                <AddressPill value={c.flyingMoney} href={`${c.explorer}/address/${c.flyingMoney}`} label="contract" />
              ) : (
                <span className="text-ink-2">Not deployed yet. It will be deployed before submission.</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {deployed.length < chains.length && (
        <p className="mt-4 text-sm text-ink-2">
          Until then, the live demo on this site runs on Arbitrum Sepolia. It is the same contract source and protocol.
        </p>
      )}

      <h2 className="mt-12 font-display text-3xl font-semibold">Why it fits {h.track}</h2>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-lg text-ink-2">
        {h.why.map((w) => (
          <li key={w}>{w}</li>
        ))}
        <li>Invariant-tested contract; unaudited; mainnet exposure bounded by immutable caps.</li>
      </ul>

      <h2 className="mt-12 font-display text-3xl font-semibold">What was built during the event</h2>
      <p className="mt-4 text-lg text-ink-2">
        The whole codebase is a rebuild started on 23 September 2026. The earlier prototype was archived and is not part
        of this submission. The commit history is public.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <ButtonLink href="/pitch" variant="secondary">
          One-pager
        </ButtonLink>
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
