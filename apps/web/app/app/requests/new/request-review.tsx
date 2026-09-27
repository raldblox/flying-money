'use client'
import type { ChainConfig } from '@flying-money/chains'
import { getChainById } from '@flying-money/chains'
import type { Certificate, Hex, SpendRequest } from '@flying-money/core'
import { useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { FunderActions } from '@/components/app/funder-actions'
import { IssueWizard, type Place } from '@/components/app/issue-wizard'
import { RiskBanner } from '@/components/app/risk-banner'
import { WalletButton } from '@/components/app/wallet-button'
import { IconAgent, IconLedger, IconServe } from '@/components/art/ink-icons'
import { GrantSummary } from '@/components/grant-summary'
import { buttonClass } from '@/components/section'
import { loadCertificate } from '@/lib/chain'
import { badgeOf, listHolders, listPlaces } from '@/lib/contacts'
import { short } from '@/lib/fmt'
import { decideInbox, getInboxItem, type InboxItem, InboxSignInNeeded, signedFromInbox } from '@/lib/inbox-client'
import { markRequest, rememberRequest } from '@/lib/seen-requests'
import { type ParsedRequest, REQUEST_TTL_SECONDS, readRequestFromHash } from '@/lib/spend-request'

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
  const [smaller, setSmaller] = useState(false)
  const [agentName, setAgentName] = useState<string | null>(null)
  const [place, setPlace] = useState<{ name: string; badge: string; verified: boolean } | null>(null)
  // contacts are read asynchronously: no warnings until we know
  const [known, setKnown] = useState(false)
  const [vouched, setVouched] = useState(false)
  // opened from the inbox (?inbox=<id>) rather than a link: decisions go back to the inbox
  const [inboxId, setInboxId] = useState<string | null>(null)
  const [inboxItem, setInboxItem] = useState<InboxItem | null>(null)
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const [decisionErr, setDecisionErr] = useState<string | null>(null)
  const { address, isConnected } = useAccount()

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('inbox')
    if (id) {
      setInboxId(id)
      getInboxItem(id)
        .then((it) => {
          setInboxItem(it)
          const signed = signedFromInbox(it)
          const chain = signed ? getChainById(signed.chainId) : undefined
          if (!signed || !chain?.flyingMoney)
            return setParsed({ ok: false, error: 'This request can’t be verified. Don’t fund it.' })
          const expired =
            it.status === 'expired' || Date.now() / 1000 > Number(signed.request.createdAt) + REQUEST_TTL_SECONDS
          setParsed({ ok: true, signed, chain, expired })
        })
        .catch((e) => {
          if (e instanceof InboxSignInNeeded) setNeedsSignIn(true)
          else setParsed({ ok: false, error: (e as Error).message })
        })
      return
    }
    const read = () => setParsed(readRequestFromHash(window.location.hash))
    read()
    window.addEventListener('hashchange', read)
    return () => window.removeEventListener('hashchange', read)
  }, [])

  const r = parsed?.ok ? parsed.signed.request : null
  // keep a local note of a request opened from a link, for the Requests tab (inbox requests live in the inbox)
  useEffect(() => {
    if (!r || !parsed?.ok || inboxId) return
    void rememberRequest({
      requestId: r.requestId,
      link: window.location.href,
      chain: parsed.chain.key,
      requester: r.requester,
      payee: r.payee,
      amount: formatUnits(r.amount, 6),
      days: Number(r.validFor / 86_400n),
      reason: r.reason,
    })
  }, [r, parsed, inboxId])
  useEffect(() => {
    if (!r || !parsed?.ok) return
    const holders = listHolders().then((hs) => setAgentName(hs.find((h) => same(h.address, r.requester))?.name ?? null))
    const places = listPlaces().then((ps) => {
      const saved = ps.find((p) => p.chain === parsed.chain.key && same(p.payee, r.payee))
      if (same(r.payee, oraclePayee))
        setPlace({ name: 'Silk Road Oracle', badge: '✓ Flying Money’s own demo service', verified: true })
      else if (saved)
        setPlace({ name: saved.name, badge: badgeOf(saved), verified: saved.verification !== 'unverified' })
      else setPlace(null)
    })
    void Promise.all([holders, places]).then(() => setKnown(true))
  }, [r, parsed, oraclePayee])

  if (needsSignIn)
    return (
      <div className="sheet p-8">
        <p className="font-display text-3xl font-semibold">Sign in to your inbox to see this request.</p>
        <p className="mt-2 text-ink-2">It’s a signature, not a transaction.</p>
        <a className={`${buttonClass('primary')} mt-4 inline-flex`} href="/app/requests">
          Go to Requests
        </a>
      </div>
    )
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
  // a top-up of an existing budget (§22.5 g, with §22.2 A4): checked against that budget, then added to it
  if (!/^0x0{64}$/.test(req.certificateId))
    return (
      <TopUpRequest
        chain={chain}
        req={req}
        agentLabel={agentName ?? 'Your agent'}
        inboxId={inboxId}
        risk={
          known && !agentName ? (
            <RiskBanner title="You haven’t saved this agent’s key">
              The request is signed by <span className="font-mono">{short(req.requester)}</span>. Make sure it’s your
              agent’s address before adding money.
            </RiskBanner>
          ) : null
        }
      />
    )
  const days = Number(req.validFor / 86_400n)
  const agentLabel = agentName ?? 'Your agent'
  const placeName = place?.name ?? short(req.payee)
  const wrongWallet = isConnected && !same(address, req.owner)
  const places: Place[] = [{ name: placeName, address: req.payee, verified: true, badge: place?.badge }]
  // Like a bank flagging a new payee: say what we can't vouch for, and keep saying it through funding.
  const agentUnknown = known && !agentName
  const placeUnknown = known && !place
  const placeUnverified = known && Boolean(place) && !place?.verified
  const needsVouch = agentUnknown && placeUnknown
  const risk = needsVouch ? (
    <RiskBanner tone="danger" title="Check before you pay: you haven’t saved this agent or this service">
      Anyone can send a request link. Only approve if you asked your agent for this yourself and you recognise both
      addresses: agent <span className="font-mono">{short(req.requester)}</span>, service{' '}
      <span className="font-mono">{short(req.payee)}</span>. If in doubt, decline: nothing moves.
    </RiskBanner>
  ) : agentUnknown ? (
    <RiskBanner title="You haven’t saved this agent’s key">
      The request is signed by <span className="font-mono">{short(req.requester)}</span>. Make sure it’s your agent’s
      address (from its settings) before funding it. Its budget can only ever pay {placeName}.
    </RiskBanner>
  ) : placeUnknown || placeUnverified ? (
    <RiskBanner title={placeUnknown ? 'This service isn’t one of your saved places' : `${placeName} isn’t verified`}>
      Money in this budget can only go to <span className="font-mono">{short(req.payee)}</span>. Check that address with
      the service itself; if it’s wrong, the money waits until the end date before it comes back.
    </RiskBanner>
  ) : null

  if (inboxItem?.status === 'approved' && step === 'review')
    return (
      <div className="sheet p-8 text-center">
        <p className="font-display text-3xl font-semibold">You funded this request.</p>
        <p className="mt-2 text-ink-2">
          {agentLabel} can pay {placeName} from it. Checked on the blockchain by the inbox.
        </p>
        {inboxItem.certificateId && (
          <a
            className={`${buttonClass('primary')} mt-4 inline-flex`}
            href={`/c/${chain.key}/${inboxItem.certificateId}`}
          >
            Watch the budget
          </a>
        )}
      </div>
    )
  if (inboxItem?.status === 'declined' && step === 'review')
    return (
      <div className="sheet p-8 text-center">
        <p className="font-display text-3xl font-semibold">You declined this request.</p>
        <p className="mt-2 text-ink-2">No money moved. Your agent has been told.</p>
      </div>
    )

  if (step === 'fund')
    return (
      <div className="grid gap-6">
        <button type="button" onClick={() => setStep('review')} className="w-fit text-indigo underline">
          ← Back to the request
        </button>
        {risk}
        {smaller && (
          <p className="sheet p-4 text-sm">
            Enter the amount you want to fund, at most <strong>{usdc(req.amount)} USDC</strong>. Your agent is told the
            actual amount.
          </p>
        )}
        {decisionErr && (
          <p role="alert" className="sheet border-l-4 border-amber p-4 text-sm">
            Your inbox couldn’t record this yet ({decisionErr}). If the budget was created, it still works: your agent
            finds it on the blockchain by itself.
          </p>
        )}
        <IssueWizard
          chain={chain}
          places={places}
          onIssued={(info) => {
            if (inboxId)
              // the inbox checks this transaction on-chain before it marks the request approved (R2)
              void decideInbox(inboxId, { approved: { certificateId: info.id, txHash: info.hash } }).catch((e) =>
                setDecisionErr((e as Error).message),
              )
            else void markRequest(req.requestId, 'funded', info.id)
          }}
          preset={{
            placeAddress: req.payee,
            spender: req.requester,
            spenderMode: 'paste',
            amount: smaller ? '' : formatUnits(req.amount, 6),
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
      {risk}
      <article className="sheet overflow-hidden">
        <div className="border-b border-line p-6 sm:p-8">
          <p className="smallcaps text-sm text-seal">Budget request · {chain.chain.name}</p>
          <h2 className="mt-2 font-display text-4xl font-semibold leading-tight sm:text-5xl">
            {agentLabel} asks for <span className="text-seal">{usdc(req.amount)} USDC</span>
          </h2>
          <p className="mt-2 text-lg text-ink-2">
            to pay <strong className="text-ink">{placeName}</strong>, for {days} day{days === 1 ? '' : 's'}.
          </p>
          <p className="mt-3 text-sm text-ink-2">If you fund it as asked:</p>
          <GrantSummary
            className="mt-1"
            amount={req.amount}
            seller={placeName}
            user={agentLabel}
            expiresAt={BigInt(Math.floor(Date.now() / 1000)) + req.validFor}
            test={!chain.mainnet}
          />
        </div>

        <dl className="grid gap-px bg-line sm:grid-cols-3">
          <Fact icon={<IconAgent className="size-9" />} label="Who asks">
            <p className="font-medium">{agentName ?? 'An agent key you haven’t saved'}</p>
            <p className="font-mono text-xs text-ink-2">{short(req.requester)}</p>
            <p className="mt-1 text-xs text-ink">✓ Signed by this key: the request wasn’t changed</p>
          </Fact>
          <Fact icon={<IconServe className="size-9" />} label="Who can be paid">
            <p className="font-medium">{placeName}</p>
            <p className="font-mono text-xs text-ink-2">{short(req.payee)}</p>
            <p className={`mt-1 text-xs ${place?.verified ? 'text-ink' : 'text-amber'}`}>
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
          {needsVouch && (
            <label className="flex w-full cursor-pointer items-start gap-3 rounded-md border border-seal/40 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-0.5 size-4 accent-seal"
                checked={vouched}
                onChange={(e) => setVouched(e.target.checked)}
              />
              <span>
                I asked my agent for this, and I’ve checked both addresses. I understand money for a wrong address only
                comes back after the end date.
              </span>
            </label>
          )}
          <WalletButton chain={chain} />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              className={buttonClass('secondary')}
              onClick={() => {
                if (inboxId)
                  void decideInbox(inboxId, { declined: {} })
                    .then(() => setStep('declined'))
                    .catch((e) => setDecisionErr((e as Error).message))
                else {
                  void markRequest(req.requestId, 'declined')
                  setStep('declined')
                }
              }}
            >
              Decline
            </button>
            <button
              type="button"
              className={buttonClass('secondary')}
              disabled={!isConnected || wrongWallet || (needsVouch && !vouched)}
              onClick={() => {
                setSmaller(true)
                setStep('fund')
              }}
            >
              Approve a smaller budget
            </button>
            <button
              type="button"
              className={buttonClass('primary')}
              disabled={!isConnected || wrongWallet || (needsVouch && !vouched)}
              onClick={() => {
                setSmaller(false)
                setStep('fund')
              }}
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
          {decisionErr && step === 'review' && (
            <p role="alert" className="w-full text-sm text-seal">
              {decisionErr}
            </p>
          )}
          {needsVouch && !vouched && (
            <p className="w-full text-sm text-ink-2">
              Tick the box above to approve a request from someone you haven’t saved.
            </p>
          )}
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

/** A top-up request: the budget must be one you funded, spendable by this agent, paying the same seller (§22.2 A4). */
function TopUpRequest({
  chain,
  req,
  agentLabel,
  inboxId,
  risk,
}: {
  chain: ChainConfig
  req: SpendRequest
  agentLabel: string
  inboxId: string | null
  risk: React.ReactNode
}) {
  const { address, isConnected } = useAccount()
  const [cert, setCert] = useState<Certificate | null | undefined>(undefined)
  const [done, setDone] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null)
  useEffect(() => {
    void loadCertificate(chain.key, req.certificateId)
      .then(setCert)
      .catch(() => setCert(null))
  }, [chain.key, req.certificateId])
  if (cert === undefined)
    return <div className="sheet h-40 animate-pulse motion-reduce:animate-none" aria-busy="true" />
  const problem = !cert
    ? 'That budget can’t be found on this network.'
    : !same(cert.spender, req.requester)
      ? 'That budget can’t be spent by the agent asking. Don’t add money to it.'
      : !same(cert.payee, req.payee)
        ? 'That budget pays a different seller than the request says. Don’t add money to it.'
        : !same(cert.funder, req.owner)
          ? 'You didn’t fund that budget, so this request isn’t for you.'
          : cert.closed || BigInt(Math.floor(Date.now() / 1000)) > cert.expiresAt
            ? 'That budget has ended. Fund a new one instead.'
            : null
  return (
    <div className="grid gap-6">
      {risk}
      <article className="sheet p-6 sm:p-8">
        <p className="smallcaps text-sm text-seal">Top-up request · {chain.chain.name}</p>
        <h2 className="mt-2 font-display text-4xl font-semibold leading-tight">
          {agentLabel} asks you to add <span className="text-seal">{usdc(req.amount)} USDC</span>
        </h2>
        {cert && (
          <GrantSummary
            className="mt-3"
            amount={cert.faceValue}
            seller={short(cert.payee)}
            user={agentLabel}
            expiresAt={cert.expiresAt}
            test={!chain.mainnet}
          />
        )}
        {(req.reason || req.origin) && (
          <figure className="mt-4 rounded-md border border-dashed border-amber/70 bg-paper-2/60 p-4">
            <figcaption className="smallcaps text-xs text-amber">Written by the agent, not verified</figcaption>
            {req.reason && <blockquote className="mt-2 whitespace-pre-wrap break-words">“{req.reason}”</blockquote>}
          </figure>
        )}
        {problem ? (
          <p role="alert" className="mt-4 rounded-md border-l-4 border-seal bg-seal/10 p-3">
            {problem}
          </p>
        ) : done ? (
          <p role="status" className="mt-4 font-medium">
            ✓ {done}
          </p>
        ) : !isConnected || !same(address, req.owner) ? (
          <p className="mt-4 text-ink-2">Connect the wallet the request is addressed to ({short(req.owner)}).</p>
        ) : (
          cert && (
            <div className="mt-4">
              <p className="text-sm text-ink-2">You can add less than asked. It still pays only the same seller.</p>
              <FunderActions
                chain={chain}
                cert={cert}
                initial={{ panel: 'topup', amount: formatUnits(req.amount, 6) }}
                onDone={() => void loadCertificate(chain.key, req.certificateId).then(setCert)}
                onConfirmed={(action, txHash) => {
                  if (action !== 'topUp') return
                  setDone('Added. Your agent finds the new amount on the blockchain by itself.')
                  if (inboxId)
                    void decideInbox(inboxId, { approved: { certificateId: req.certificateId, txHash } }).catch((e) =>
                      setErr((e as Error).message),
                    )
                  else void markRequest(req.requestId, 'funded', req.certificateId)
                }}
              />
            </div>
          )
        )}
        {err && <p className="mt-2 text-sm text-amber">Your inbox couldn’t record this yet ({err}).</p>}
        {inboxId && !problem && !done && (
          <button
            type="button"
            className="mt-4 text-sm text-ink-2 underline"
            onClick={() =>
              void decideInbox(inboxId, { declined: {} })
                .then(() => setDone('Declined. Nothing was sent.'))
                .catch((e) => setErr((e as Error).message))
            }
          >
            Decline
          </button>
        )}
      </article>
    </div>
  )
}
