'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount, useWalletClient } from 'wagmi'
import { buttonClass } from '@/components/section'
import { short } from '@/lib/fmt'
import { type InboxItem, signInToInbox, signOutOfInbox } from '@/lib/inbox-client'
import { listSeenRequests, type SeenRequest } from '@/lib/seen-requests'
import { useInbox } from '@/lib/use-inbox'
import { useAccountCtx } from './context'

const usdc = (v: string) => {
  const [i = '0', f = ''] = formatUnits(BigInt(v), 6).split('.')
  return `${i}.${f.replace(/0+$/, '').padEnd(2, '0')}`
}

const INBOX_STATUS: Record<InboxItem['status'], { label: string; className: string }> = {
  asked: { label: 'Waiting for you', className: 'border-amber/60 text-amber' },
  approved: { label: 'Funded', className: 'border-celadon/60 text-celadon' },
  declined: { label: 'Declined', className: 'border-line text-ink-2' },
  expired: { label: 'Expired', className: 'border-line text-ink-2' },
}
const SEEN_STATUS: Record<SeenRequest['status'], { label: string; className: string }> = {
  waiting: { label: 'Waiting for you', className: 'border-amber/60 text-amber' },
  funded: { label: 'Funded', className: 'border-celadon/60 text-celadon' },
  declined: { label: 'Declined', className: 'border-line text-ink-2' },
}

/** Budget requests from your agents: the inbox (§21.4.2), plus any opened from a link on this device. */
export function Requests() {
  const { chain, placeName, holderName } = useAccountCtx()
  const { address } = useAccount()
  const { data: wallet } = useWalletClient({ chainId: chain.chain.id })
  const inbox = useInbox()
  const [signing, setSigning] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [seen, setSeen] = useState<SeenRequest[] | null>(null)
  useEffect(() => {
    void listSeenRequests().then(setSeen)
  }, [])
  const mine = inbox.owner && address && inbox.owner.toLowerCase() === address.toLowerCase()

  const signIn = async () => {
    if (!wallet || !address) return
    setSigning(true)
    setErr(null)
    try {
      await signInToInbox(wallet, chain, address)
    } catch (e) {
      setErr(/rejected|denied/i.test((e as Error).message) ? 'You cancelled the signature.' : (e as Error).message)
    } finally {
      setSigning(false)
    }
  }

  const waiting = inbox.items?.filter((i) => i.status === 'asked') ?? []
  // how often each agent asked today, so a burst of requests is visible (§22.5 g)
  const today = new Date().toDateString()
  const askedToday = (requester: string) =>
    (inbox.items ?? []).filter(
      (i) =>
        i.requester.toLowerCase() === requester.toLowerCase() &&
        new Date(Number(i.request.createdAt) * 1000).toDateString() === today,
    ).length
  const done = inbox.items?.filter((i) => i.status !== 'asked') ?? []

  return (
    <div>
      <h1 className="font-display text-4xl font-semibold">Requests</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Your agents ask here when they need a budget. Review who asks, who could be paid and how much. Nothing moves
        unless you fund it from your wallet.
      </p>

      {!mine ? (
        <section className="sheet mt-6 p-6">
          <h2 className="font-display text-2xl font-semibold">Open your inbox</h2>
          <p className="mt-2 max-w-xl text-ink-2">
            {inbox.owner
              ? `This browser is signed in as ${short(inbox.owner)}, not your connected wallet. Sign in again to see your own requests.`
              : 'Sign in with your wallet to see requests from your agents. It’s a signature, not a transaction: free, and it moves nothing.'}
          </p>
          <button
            type="button"
            className={`${buttonClass('primary')} mt-4`}
            disabled={!wallet || signing}
            onClick={signIn}
          >
            {signing ? 'Check your wallet…' : 'Sign in with wallet'}
          </button>
          {err && (
            <p role="alert" className="mt-2 text-sm text-seal">
              {err}
            </p>
          )}
        </section>
      ) : (
        <section className="mt-6" aria-labelledby="inbox-title">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="inbox-title" className="font-display text-2xl font-semibold">
              Waiting for you {waiting.length > 0 && <span className="text-seal">({waiting.length})</span>}
            </h2>
            <button type="button" className="text-sm text-ink-2 underline" onClick={() => void signOutOfInbox()}>
              Sign out of inbox
            </button>
          </div>
          {inbox.error && (
            <p role="alert" className="mt-2 text-sm text-seal">
              Couldn’t load your requests: {inbox.error}
            </p>
          )}
          {inbox.items === null ? (
            <div
              className="mt-4 h-20 animate-pulse rounded-md bg-paper-2 motion-reduce:animate-none"
              aria-busy="true"
            />
          ) : waiting.length === 0 ? (
            <div className="mt-4 rounded-md border border-dashed border-line p-6 text-center">
              <p className="font-display text-xl">Nothing waiting.</p>
              <p className="mt-1 text-sm text-ink-2">
                To let an agent ask, open it under{' '}
                <a className="underline" href="/app/people">
                  People &amp; agents
                </a>{' '}
                and choose <strong>Allow requests</strong>.
              </p>
            </div>
          ) : (
            <ul className="mt-4 grid gap-2">
              {waiting.map((r) => (
                <InboxRow
                  key={r.requestId}
                  r={r}
                  placeName={placeName}
                  holderName={holderName}
                  asked={askedToday(r.requester)}
                />
              ))}
            </ul>
          )}
          {done.length > 0 && (
            <>
              <h3 className="mt-8 font-display text-xl font-semibold">Answered</h3>
              <ul className="mt-3 grid gap-2">
                {done.map((r) => (
                  <InboxRow
                    key={r.requestId}
                    r={r}
                    placeName={placeName}
                    holderName={holderName}
                    asked={askedToday(r.requester)}
                  />
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {seen && seen.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display text-xl font-semibold">Opened from links</h2>
          <ul className="mt-3 grid gap-2">
            {seen.map((r) => {
              const s = SEEN_STATUS[r.status]
              return (
                <li key={r.requestId}>
                  <a
                    href={r.status === 'funded' && r.certificateId ? `/c/${r.chain}/${r.certificateId}` : r.link}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-line bg-paper p-4 hover:border-ink/40"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-semibold">
                        {r.amount} USDC for {placeName(r.payee)}
                      </span>
                      <span className="block truncate text-sm text-ink-2">
                        {r.days} days · from agent {short(r.requester)} · {new Date(r.seenAt).toLocaleDateString()}
                      </span>
                    </span>
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
                      {s.label}
                    </span>
                  </a>
                </li>
              )
            })}
          </ul>
        </section>
      )}
      <p className="mt-6 text-xs text-ink-2">Showing {chain.chain.name}.</p>
    </div>
  )
}

function InboxRow({
  r,
  placeName,
  holderName,
  asked,
}: {
  asked: number
  r: InboxItem
  placeName: (p: `0x${string}`) => string
  holderName: (s: `0x${string}`) => string | null
}) {
  const s = INBOX_STATUS[r.status]
  const days = Math.round(Number(r.request.validFor) / 86_400)
  const who = holderName(r.requester)
  return (
    <li>
      <Link
        href={`/app/requests/new?inbox=${r.requestId}`}
        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-md border border-line bg-paper p-4 hover:border-ink/40"
      >
        <span className="min-w-0">
          <span className="block truncate font-semibold">
            {usdc(r.request.amount!)} USDC for {placeName(r.payee)}
          </span>
          <span className="block truncate text-sm text-ink-2">
            {days} days · from {who ?? <span className="font-mono">{short(r.requester)}</span>}
            {!who && <span className="ml-1 text-amber">(not saved)</span>} ·{' '}
            {new Date(Number(r.request.createdAt) * 1000).toLocaleDateString()}
          </span>
          {asked > 1 && <span className="mt-1 block text-xs text-amber">This agent asked {asked} times today.</span>}
          {r.request.reason && (
            <span className="mt-1 block truncate text-sm italic text-ink-2">“{r.request.reason}”</span>
          )}
        </span>
        <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.className}`}>{s.label}</span>
      </Link>
    </li>
  )
}
