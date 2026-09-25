'use client'
import type { Certificate } from '@flying-money/core'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { erc20Abi } from 'viem'
import { useAccount, useReadContract } from 'wagmi'
import { useCertificates } from '@/components/app/certificate-lists'
import { short, usdc } from '@/lib/fmt'
import { listSeenRequests, type SeenRequest } from '@/lib/seen-requests'
import { BudgetRow, budgetState } from './budget-row'
import { useAccountCtx } from './context'

const ACTIONS = [
  {
    href: '/app/give?for=person',
    title: 'Give a budget',
    sub: 'Money for one place, for a person',
    icon: 'M12 5v14M5 12h14',
  },
  {
    href: '/app/give?for=agent',
    title: 'Fund an agent',
    sub: 'A spending limit for an AI agent',
    icon: 'M5 7h14v10H5zM9 11l2 2-2 2M13 15h3',
  },
  {
    href: '/app/collect',
    title: 'Collect payments',
    sub: 'Money people paid you',
    icon: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
  },
  {
    href: '/shop',
    title: 'Open a till',
    sub: 'Take payments at a counter',
    icon: 'M4 9h16l-1.5-4h-13zM5 9v10h14V9M9 19v-5h6v5',
  },
]

/** The account home: balance, the four things people come here to do, what needs attention, recent budgets. */
export function AccountHome() {
  const { chain, refreshKey, refresh } = useAccountCtx()
  const { address } = useAccount()
  const q = useCertificates(chain, 'funder', refreshKey)
  const { data: balance } = useReadContract({
    address: chain.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: chain.chain.id,
    query: { enabled: Boolean(address) },
  })
  const [requests, setRequests] = useState<SeenRequest[]>([])
  useEffect(() => {
    void listSeenRequests().then(setRequests)
  }, [])

  const certs = q.data ?? []
  const active = certs.filter((c) => ['active', 'ending'].includes(budgetState(c)))
  const ended = certs.filter((c) => budgetState(c) === 'ended')
  const sum = (cs: Certificate[], f: (c: Certificate) => bigint) => cs.reduce((t, c) => t + f(c), 0n)
  const inBudgets = sum(active, (c) => c.faceValue - c.redeemed)
  const spent = sum(certs, (c) => c.redeemed)
  const toTakeBack = sum(ended, (c) => c.faceValue - c.redeemed)
  const waiting = requests.filter((r) => r.status === 'waiting')

  return (
    <div className="grid gap-8">
      {/* balance */}
      <section className="sheet flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8" aria-label="Wallet">
        <div>
          <p className="smallcaps text-xs text-ink-2">Available in your wallet · {chain.chain.name}</p>
          <p className="mt-1 font-display text-5xl font-semibold tabular-nums lining-nums sm:text-6xl">
            {balance !== undefined ? usdc(balance) : '—'}
            <span className="ml-2 text-2xl text-ink-2">USDC</span>
          </p>
          <p className="mt-1 font-mono text-sm text-ink-2">{address ? short(address) : ''}</p>
        </div>
        <div className="grid grid-cols-3 gap-6 text-right">
          <Figure label="In active budgets" value={usdc(inBudgets)} />
          <Figure label="Spent from budgets" value={usdc(spent)} />
          <Figure label="Ready to take back" value={usdc(toTakeBack)} highlight={toTakeBack > 0n} />
        </div>
      </section>

      {/* the four things people come to do */}
      <section aria-label="Quick actions">
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {ACTIONS.map((a) => (
            <li key={a.href}>
              <Link
                href={a.href}
                className="group flex h-full flex-col gap-3 rounded-md border border-line bg-paper p-4 transition-colors hover:border-seal focus-visible:outline-2 focus-visible:outline-indigo"
              >
                <span className="grid size-11 place-items-center rounded-full bg-seal text-on-seal transition-transform group-hover:scale-105">
                  <svg
                    viewBox="0 0 24 24"
                    className="size-5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    aria-hidden
                  >
                    <path d={a.icon} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span>
                  <span className="block font-semibold">{a.title}</span>
                  <span className="block text-sm text-ink-2">{a.sub}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* what needs a decision */}
      {(ended.length > 0 || waiting.length > 0) && (
        <section aria-labelledby="attention">
          <h2 id="attention" className="font-display text-2xl font-semibold">
            Needs your attention
          </h2>
          <ul className="mt-3 grid gap-2">
            {waiting.map((r) => (
              <li key={r.requestId}>
                <a
                  href={r.link}
                  className="flex items-center justify-between gap-3 rounded-md border border-amber/60 bg-paper p-4 hover:border-amber"
                >
                  <span>
                    <span className="font-semibold">A budget request is waiting</span>
                    <span className="block text-sm text-ink-2">
                      {r.amount} USDC for {r.days} days · from {short(r.requester)}
                    </span>
                  </span>
                  <span className="text-sm font-medium text-indigo">Review →</span>
                </a>
              </li>
            ))}
            {ended.map((c) => (
              <BudgetRow key={c.id} cert={c} onChanged={refresh} />
            ))}
          </ul>
        </section>
      )}

      {/* recent budgets */}
      <section aria-labelledby="recent">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="recent" className="font-display text-2xl font-semibold">
            Your budgets
          </h2>
          {certs.length > 0 && (
            <Link href="/app/budgets" className="text-sm font-medium text-indigo hover:underline">
              See all {certs.length} →
            </Link>
          )}
        </div>
        {q.isPending ? (
          <div className="mt-3 grid gap-2" aria-busy="true">
            {[0, 1, 2].map((k) => (
              <div key={k} className="h-24 animate-pulse rounded-md bg-paper-2 motion-reduce:animate-none" />
            ))}
          </div>
        ) : q.isError ? (
          <p role="alert" className="mt-3 text-seal">
            Couldn’t read your budgets from the chain.{' '}
            <button type="button" onClick={() => void q.refetch()} className="text-indigo underline">
              Try again
            </button>
          </p>
        ) : active.length === 0 ? (
          <div className="mt-3 rounded-md border border-dashed border-line p-8 text-center">
            <p className="font-display text-2xl">No active budgets.</p>
            <p className="mt-1 text-ink-2">Give one to a person, or fund an agent: it takes a minute.</p>
            <Link href="/app/give" className="mt-4 inline-block font-medium text-indigo underline">
              Give a budget →
            </Link>
          </div>
        ) : (
          <ul className="mt-3 grid gap-2">
            {active.slice(0, 4).map((c) => (
              <BudgetRow key={c.id} cert={c} onChanged={refresh} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Figure({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className={`font-mono text-xl tabular-nums ${highlight ? 'text-seal' : ''}`}>{value}</p>
      <p className="text-xs text-ink-2">{label}</p>
    </div>
  )
}
