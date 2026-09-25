import { getChain, isChainKey } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AddressPill } from '@/components/address-pill'
import { AutoRefresh } from '@/components/auto-refresh'
import { Seal } from '@/components/seal'
import { StatusChip } from '@/components/status-chip'
import { Tally } from '@/components/tally'
import { certificateTimeline, loadCertificate, type TimelineEvent } from '@/lib/chain'
import { relTime, short, usdc, utcDate } from '@/lib/fmt'
import { SITE } from '@/lib/site'

export const dynamic = 'force-dynamic'

type Params = Promise<{ chain: string; id: string }>

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params
  return { title: `Certificate ${short(id)}` }
}

export default async function CertificatePage({ params }: { params: Params }) {
  const { chain: chainKey, id } = await params
  if (!isChainKey(chainKey) || !/^0x[0-9a-fA-F]{64}$/.test(id)) notFound()
  const chain = getChain(chainKey)
  if (!chain.flyingMoney) notFound()

  let cert: Awaited<ReturnType<typeof loadCertificate>>
  try {
    cert = await loadCertificate(chainKey, id as Hex)
  } catch {
    return <Unavailable chainName={chain.chain.name} />
  }
  if (!cert) notFound()

  let timeline: TimelineEvent[] | null = null
  try {
    timeline = await certificateTimeline(chainKey, id as Hex)
  } catch {
    timeline = null
  }

  const served = await sellerRecord(cert.payee, id as Hex)
  const now = BigInt(Math.floor(Date.now() / 1000))
  const status = cert.closed ? 'closed' : now > cert.expiresAt ? 'expired' : 'open'
  const ex = (path: string) => `${chain.explorer}/${path}`
  const remaining = cert.faceValue - cert.redeemed

  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="text-sm text-ink-2">
        {chain.chain.name} · {chain.mainnet ? SITE.mainnetMode : SITE.testnetMode}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-4">
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          Budget <span className="font-mono text-3xl sm:text-4xl">{short(id, 6, 4)}</span>
        </h1>
        <StatusChip kind={status}>{status[0]!.toUpperCase() + status.slice(1)}</StatusChip>
        <Seal size={40} label="Issued on-chain" />
        {status === 'open' && <AutoRefresh />}
      </div>

      {served && status !== 'closed' && (
        <section aria-labelledby="spend" className="mt-8 sheet grid gap-4 p-6 sm:grid-cols-3">
          <h2 id="spend" className="sr-only">
            Spending so far
          </h2>
          <Stat big={usdc(served.consumed)} small="spent so far, by the service’s own record" />
          <Stat big={usdc(cert.redeemed)} small="collected on the blockchain (final)" />
          <Stat big={usdc(cert.faceValue - served.consumed)} small="left to spend" />
          <p className="text-xs text-ink-2 sm:col-span-3">
            Payments are signed slips checked by the service instantly; it collects them on the blockchain in batches.
            Only the collected amount is on-chain; the rest is what the service reports it has accepted.
          </p>
        </section>
      )}

      <section aria-labelledby="terms" className="mt-10 sheet p-6">
        <h2 id="terms" className="font-display text-2xl font-semibold">
          Terms
        </h2>
        <dl className="mt-4 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Row label="Funded by">
            <AddressPill value={cert.funder} href={ex(`address/${cert.funder}`)} label="funder" />
          </Row>
          <Row label="Can be paid (the only one)">
            <AddressPill value={cert.payee} href={ex(`address/${cert.payee}`)} label="payee" />
          </Row>
          <Row label="Can spend (a key holding no money)">
            <AddressPill value={cert.spender} href={ex(`address/${cert.spender}`)} label="spender" />
          </Row>
          <Row label="Token">
            <AddressPill value={chain.usdc} href={ex(`address/${chain.usdc}`)} label="USDC" />
            <span className="ml-2 text-sm text-ink-2">USDC</span>
          </Row>
          <Row label="Face value">
            <span className="font-mono tabular-nums">{usdc(cert.faceValue)} USDC</span>
          </Row>
          <Row label={cert.closed ? 'Leftovers returned' : 'Not collected yet'}>
            <span className="font-mono tabular-nums">{usdc(remaining)} USDC</span>
          </Row>
          <Row label="Expires">
            <span>
              {utcDate(cert.expiresAt)} <span className="text-ink-2">({relTime(cert.expiresAt)})</span>
            </span>
          </Row>
          <Row label="Budget id">
            <AddressPill value={id} label="budget id" />
          </Row>
        </dl>
        <div className="mt-6">
          <Tally used={cert.redeemed} face={cert.faceValue} label="collected" />
        </div>
        {status !== 'closed' && (
          <p className="mt-3 text-sm text-ink-2">
            Whatever isn’t collected goes back to whoever funded it after the end date: they take it back from their
            Dashboard. Nobody can cancel it early.
          </p>
        )}
      </section>

      <section aria-labelledby="timeline" className="mt-10">
        <h2 id="timeline" className="font-display text-2xl font-semibold">
          Timeline
        </h2>
        {timeline === null ? (
          <p className="mt-4 rounded-md border border-line p-4 text-ink-2">
            The event history couldn’t be loaded from the RPC right now.{' '}
            <a className="text-indigo underline" href={ex(`address/${chain.flyingMoney}#events`)}>
              View the contract’s events on the explorer
            </a>
            .
          </p>
        ) : timeline.length === 0 ? (
          <p className="mt-4 text-ink-2">No events yet.</p>
        ) : (
          <ol className="mt-4 sheet divide-y divide-line">
            {timeline.map((e) => (
              <li key={`${e.txHash}-${e.kind}`} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-3">
                  <StatusChip kind={e.kind === 'Redeemed' ? 'redeemed' : e.kind === 'Reclaimed' ? 'closed' : 'open'}>
                    {LABEL[e.kind]}
                  </StatusChip>
                  <span className="font-mono text-sm tabular-nums">{describe(e)}</span>
                </div>
                <a className="font-mono text-sm text-indigo underline decoration-line" href={ex(`tx/${e.txHash}`)}>
                  {short(e.txHash)} ↗
                </a>
              </li>
            ))}
          </ol>
        )}
      </section>

      <details className="mt-10 sheet p-6">
        <summary className="cursor-pointer font-display text-xl font-semibold">Verify it yourself</summary>
        <p className="mt-3 text-ink-2">Read this budget directly from the chain, no website needed:</p>
        <pre className="mt-3 overflow-x-auto rounded bg-paper-2 p-4 font-mono text-sm">
          <code>{`cast call ${chain.flyingMoney} \\
  "getCertificate(bytes32)((address,address,address,uint128,uint128,uint64,bool))" \\
  ${id} \\
  --rpc-url ${chain.chain.rpcUrls.default.http[0]}`}</code>
        </pre>
        <p className="mt-3 text-sm text-ink-2">
          Contract source (verified):{' '}
          <a className="text-indigo underline" href={ex(`address/${chain.flyingMoney}`)}>
            {short(chain.flyingMoney)}
          </a>
          {chain.blockscoutApi && (
            <>
              {' '}
              ·{' '}
              <a
                className="text-indigo underline"
                href={`${chain.blockscoutApi.replace(/\/api\/?$/, '')}/address/${chain.flyingMoney}?tab=contract`}
              >
                Blockscout
              </a>
            </>
          )}
        </p>
      </details>
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm text-ink-2">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

const LABEL: Record<TimelineEvent['kind'], string> = {
  Issued: 'Funded',
  'Topped up': 'Topped up',
  Extended: 'Extended',
  Redeemed: 'Collected',
  Reclaimed: 'Leftovers taken back',
}

function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div>
      <p className="font-display text-4xl font-semibold tabular-nums lining-nums">{big}</p>
      <p className="text-sm text-ink-2">{small} (USDC)</p>
    </div>
  )
}

/**
 * The service's own record of what it accepted (its public payee feed, §12.3), for the hosted demo service only.
 * Display only: the collected amount on-chain is the fact.
 */
async function sellerRecord(payee: Hex, id: Hex): Promise<{ consumed: bigint } | null> {
  const known = process.env.PAYEE_ADDRESS
  const base = process.env.ORACLE_URL ?? 'https://flying-money-oracle.vercel.app'
  if (!known || known.toLowerCase() !== payee.toLowerCase()) return null
  try {
    const r = await fetch(`${base}/fm/redeemable/${id}`, { cache: 'no-store', signal: AbortSignal.timeout(4000) })
    if (!r.ok) return { consumed: 0n }
    const j = (await r.json()) as { state?: { consumed?: string } }
    return { consumed: BigInt(j.state?.consumed ?? '0') }
  } catch {
    return null
  }
}

function describe(e: TimelineEvent): string {
  const d = e.detail
  switch (e.kind) {
    case 'Issued':
      return `${usdc(d.faceValue as bigint)} USDC until ${utcDate(d.expiresAt as bigint)}`
    case 'Topped up':
      return `+${usdc(d.amount as bigint)} → ${usdc(d.newFaceValue as bigint)} USDC`
    case 'Extended':
      return `until ${utcDate(d.newExpiresAt as bigint)}`
    case 'Redeemed':
      return `paid ${usdc(d.paid as bigint)} USDC (total ${usdc(d.cumulative as bigint)})`
    case 'Reclaimed':
      return `${usdc(d.refunded as bigint)} USDC taken back by the funder`
  }
}

function Unavailable({ chainName }: { chainName: string }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <h1 className="font-display text-4xl font-semibold">{chainName} is unreachable</h1>
      <p className="mt-4 text-ink-2">We couldn’t read this budget from the chain. Try again in a moment.</p>
    </div>
  )
}
