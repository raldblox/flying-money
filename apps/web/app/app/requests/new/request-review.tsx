'use client'
import type { Hex } from '@flying-money/core'
import { useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { IssueWizard, type Place } from '@/components/app/issue-wizard'
import { WalletButton } from '@/components/app/wallet-button'
import { IconAgent, IconLedger, IconServe } from '@/components/art/ink-icons'
import { buttonClass } from '@/components/section'
import { badgeOf, listHolders, listPlaces } from '@/lib/contacts'
import { short } from '@/lib/fmt'
import { type ParsedRequest, readRequestFromHash } from '@/lib/spend-request'

const usdc = (v: bigint) => {
  const [i = '0', f = ''] = formatUnits(v, 6).split('.')
  return `${i}.${f.replace(/0+$/, '').padEnd(2, '0')}`
}
const same = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase())

/**
 * An agent's budget request (§21.4.3): who asks, where the money could go, how much and how long, and the agent's
 * reason in an unverified block (R4). Approving opens the Fund form, prefilled; only the owner's own on-chain
 * transaction moves money (R1).
 */
export function RequestReview({ oraclePayee }: { oraclePayee?: Hex }) {
  const [parsed, setParsed] = useState<ParsedRequest | null>(null)
  const [step, setStep] = useState<'review' | 'fund' | 'declined'>('review')
  const [agentName, setAgentName] = useState<string | null>(null)
  const [place, setPlace] = useState<{ name: string; badge: string; verified: boolean } | null>(null)
  const { address, isConnected } = useAccount()

  useEffect(() => {
    const read = () => setParsed(readRequestFromHash(window.location.hash))
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  const r = parsed?.ok ? parsed.signed.request : null
  useEffect(() => {
    if (!r || !parsed?.ok) return
    void listHolders().then((hs) => setAgentName(hs.find((h) => same(h.address, r.requester))?.name ?? null))
    void listPlaces().then((ps) => {
      const saved = ps.find((p) => p.chain === parsed.chain.key && same(p.payee, r.payee))
      if (same(r.payee, oraclePayee))
        setPlace({ name: 'Silk Road Oracle', badge: '✓ Flying Money’s own demo service', verified: true })
      else if (saved)
        setPlace({ name: saved.name, badge: badgeOf(saved), verified: saved.verification !== 'unverified' })
      else setPlace(null)
    })
  }, [r, parsed, oraclePayee])

  if (!parsed) return null
  if (!parsed.ok)
    return (
      <div role="alert" className="sheet border-l-4 border-seal p-8">
        <p className="font-display text-3xl font-semibold">This request can’t be used.</p>
        <p className="mt-2 text-lg text-ink-2">{parsed.error}</p>
      </div>
    )

  const { chain, expired } = parsed
  const req = r!
  if (!/^0x0{64}$/.test(req.certificateId))
    return (
      <div role="alert" className="sheet border-l-4 border-amber p-8">
        <p className="font-display text-3xl font-semibold">This is a request to top up an existing budget.</p>
        <p className="mt-2 text-lg text-ink-2">
          Top-up requests can’t be approved from this page yet. Open the budget from your Dashboard and use Top up there
          if you agree.
        </p>
        <a className="mt-4 inline-block text-indigo underline" href={`/c/${chain.key}/${req.certificateId}`}>
          Open that budget
        </a>
      </div>
    )
  const days = Number(req.validFor / 86_400n)
  const agentLabel = agentName ?? 'Your agent'
  const placeName = place?.name ?? short(req.payee)
  const wrongWallet = isConnected && !same(address, req.owner)
  const places: Place[] = [{ name: placeName, address: req.payee, verified: true, badge: place?.badge }]

  if (step === 'fund')
    return (
      <div className="grid gap-6">
        <button type="button" onClick={() => setStep('review')} className="w-fit text-indigo underline">
          ← Back to the request
        </button>
        <IssueWizard
          chain={chain}
          places={places}
          onIssued={() => {}}
          preset={{
            placeAddress: req.payee,
            spender: req.requester,
            spenderMode: 'paste',
            amount: formatUnits(req.amount, 6),
            durationSeconds: req.validFor,
            request: { agent: agentLabel, placeName },
          }}
        />
      </div>
    )

  if (step === 'declined')
    return (
      <div className="sheet p-8 text-center">
        <p className="font-display text-3xl font-semibold">Declined. Nothing was sent anywhere.</p>
        <p className="mt-2 text-ink-2">
          No money moved. Your agent’s request simply expires; it can’t pay this service without a budget from you.
        </p>
      </div>
    )

  return (
    <div className="grid gap-6">
      <article className="sheet overflow-hidden">
        <div className="border-b border-line p-6 sm:p-8">
          <p className="smallcaps text-sm text-seal">Budget request · {chain.chain.name}</p>
          <h2 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl">
            {agentLabel} asks for <span className="text-seal">{usdc(req.amount)} USDC</span>
          </h2>
          <p className="mt-2 text-lg text-ink-2">
            to pay <strong className="text-ink">{placeName}</strong>, for {days} day{days === 1 ? '' : 's'}.
          </p>
        </div>

        <dl className="grid gap-px bg-line sm:grid-cols-3">
          <Fact icon={<IconAgent className="size-9" />} label="Who asks">
            <p className="font-medium">{agentName ?? 'An agent key you haven’t saved'}</p>
            <p className="font-mono text-xs text-ink-2">{short(req.requester)}</p>
            <p className="mt-1 text-xs text-celadon">✓ Signed by this key: the request wasn’t changed</p>
          </Fact>
          <Fact icon={<IconServe className="size-9" />} label="Who can be paid">
            <p className="font-medium">{placeName}</p>
            <p className="font-mono text-xs text-ink-2">{short(req.payee)}</p>
            <p className={`mt-1 text-xs ${place?.verified ? 'text-celadon' : 'text-amber'}`}>
              {place ? place.badge : '⚠ Not one of your saved places: check this address'}
            </p>
          </Fact>
          <Fact icon={<IconLedger className="size-9" />} label="How much, how long">
            <p className="font-medium">
              {usdc(req.amount)} USDC · {chain.chain.name}
            </p>
            <p className="text-xs text-ink-2">
              for {days} day{days === 1 ? '' : 's'} · asked {new Date(Number(req.createdAt) * 1000).toLocaleString()}
            </p>
          </Fact>
        </dl>

        {(req.reason || req.origin) && (
          <figure className="m-6 rounded-md border border-dashed border-amber/70 bg-paper-2/60 p-4 sm:m-8">
            <figcaption className="smallcaps text-xs text-amber">Written by the agent, not verified</figcaption>
            {req.reason && (
              <blockquote className="mt-2 whitespace-pre-wrap break-words text-lg">“{req.reason}”</blockquote>
            )}
            {req.origin && <p className="mt-2 break-all font-mono text-xs text-ink-2">Service: {req.origin}</p>}
          </figure>
        )}

        <div className="border-t border-line p-6 sm:p-8">
          <p className="font-semibold">If you approve</p>
          <ul className="mt-2 grid gap-2 text-ink-2 sm:grid-cols-3">
            <li>
              <strong className="text-ink">Only {placeName}</strong> can ever be paid from it. Nobody else, not even
              your agent.
            </li>
            <li>
              <strong className="text-ink">Never more than you choose.</strong> You can give less than asked; the agent
              can’t go past it, even if its key is stolen.
            </li>
            <li>
              <strong className="text-ink">Leftovers come back</strong> to you after the end date. There’s no early
              cancel: that’s what lets the service trust it.
            </li>
          </ul>
        </div>
      </article>

      {expired ? (
        <p role="alert" className="sheet border-l-4 border-amber p-5">
          This request is more than 7 days old and has expired. Ask your agent for a new one.
        </p>
      ) : (
        <div className="sheet flex flex-wrap items-center justify-between gap-4 p-5">
          <WalletButton chain={chain} />
          <div className="flex flex-wrap gap-3">
            <button type="button" className={buttonClass('secondary')} onClick={() => setStep('declined')}>
              Decline
            </button>
            <button
              type="button"
              className={buttonClass('primary')}
              disabled={!isConnected || wrongWallet}
              onClick={() => setStep('fund')}
            >
              Approve and fund…
            </button>
          </div>
          {wrongWallet && (
            <p role="alert" className="w-full text-sm text-amber">
              This request is addressed to {short(req.owner)}, but your wallet is {short(address!)}. Your agent only
              accepts a budget from {short(req.owner)}: switch accounts in your wallet.
            </p>
          )}
          {!isConnected && <p className="w-full text-sm text-ink-2">Connect the wallet the request is addressed to.</p>}
        </div>
      )}
    </div>
  )
}

function Fact({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="bg-paper p-5">
      <dt className="flex items-center gap-2">
        {icon}
        <span className="smallcaps text-xs text-ink-2">{label}</span>
      </dt>
      <dd className="mt-2">{children}</dd>
    </div>
  )
}
