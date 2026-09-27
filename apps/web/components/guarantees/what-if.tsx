'use client'
import { useState } from 'react'
import {
  IconAgent,
  IconGift,
  IconLedger,
  IconServe,
  IconShield,
  IconThief,
  IconWorker,
} from '@/components/art/ink-icons'

type Verdict = 'protected' | 'bounded' | 'your-risk' | 'by-design'

const VERDICT: Record<Verdict, { label: string; className: string }> = {
  protected: { label: 'Protected', className: 'border-celadon bg-celadon/15 text-ink' },
  bounded: { label: 'Limited', className: 'border-ochre text-ochre' },
  'your-risk': { label: 'Your risk', className: 'border-amber text-amber' },
  'by-design': { label: 'By design', className: 'border-indigo text-indigo' },
}

const CASES: Array<{ q: string; verdict: Verdict; a: string; worst: string; Icon: typeof IconAgent }> = [
  {
    q: 'My agent’s key is stolen',
    verdict: 'bounded',
    a: 'The thief can only pay the one seller you chose, and only up to what’s left in the budget. It can’t send money to itself or anyone else.',
    worst: 'At most what was left in that one budget.',
    Icon: IconThief,
  },
  {
    q: 'My agent goes rogue or loops',
    verdict: 'protected',
    a: 'Spending stops at the budget. The limit is enforced by the blockchain contract and by the seller, not by the agent’s prompt, so the agent can’t talk its way past it.',
    worst: 'The budget you set. Not a cent more.',
    Icon: IconAgent,
  },
  {
    q: 'The seller tries to charge more',
    verdict: 'protected',
    a: 'A seller can only collect totals your agent actually signed. Our client also checks every receipt, so a lying seller can’t push it to sign for more than one request’s price at a time.',
    worst: 'Nothing beyond what your agent signed.',
    Icon: IconServe,
  },
  {
    q: 'The seller takes the money and serves nothing',
    verdict: 'your-risk',
    a: 'Like any prepayment, paying isn’t the same as getting the service. The damage is limited to what your agent signed for that seller, and you choose sellers you trust.',
    worst: 'What the agent signed at that seller, within the budget.',
    Icon: IconShield,
  },
  {
    q: 'I want my money back before the end date',
    verdict: 'by-design',
    a: 'Not possible, on purpose. The seller accepts payments instantly, even offline, precisely because the money can’t be pulled back. After the end date you take back whatever isn’t spent.',
    worst: 'You wait until the end date for the leftovers.',
    Icon: IconGift,
  },
  {
    q: 'The internet goes down at the shop',
    verdict: 'protected',
    a: 'Returning customers keep paying: the till remembers their budget and checks each code itself. New customers are marked “unverified” and capped by the shop’s own limits.',
    worst: 'For the shop: its own offline limit for new customers.',
    Icon: IconWorker,
  },
  {
    q: 'Mia’s phone is stolen',
    verdict: 'bounded',
    a: 'The payment key on the phone is locked with her PIN. Even unlocked, it can only pay the shops in her budgets, up to what’s left.',
    worst: 'What was left at those shops.',
    Icon: IconThief,
  },
  {
    q: 'The USDC issuer freezes the funds',
    verdict: 'your-risk',
    a: 'Flying Money holds USDC, so it inherits USDC’s rules. If the issuer freezes an address, those funds are stuck. We say so plainly.',
    worst: 'The frozen amount.',
    Icon: IconLedger,
  },
]

/** "What if…?": the questions people actually ask, each with a verdict, the plain answer and the worst case. */
export function WhatIf() {
  const [i, setI] = useState(0)
  const c = CASES[i]!
  const v = VERDICT[c.verdict]
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-1" aria-label="Situations">
        {CASES.map((x, k) => (
          <li key={x.q}>
            <button
              type="button"
              aria-pressed={k === i}
              onClick={() => setI(k)}
              className={`flex w-full items-center gap-3 rounded-md border px-3 py-2.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-indigo ${k === i ? 'border-seal bg-paper-2' : 'border-line/60 hover:border-line'}`}
            >
              <x.Icon className="size-7 shrink-0" />
              <span className="font-medium">
                What if {/^(My|The) /.test(x.q) ? x.q.charAt(0).toLowerCase() + x.q.slice(1) : x.q}?
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="sheet relative p-6" aria-live="polite">
        <div key={i} className="caption-in">
          <c.Icon className="size-14" />
          <h3 className="mt-3 font-display text-3xl font-semibold leading-tight">{c.q}</h3>
          <span
            className={`stamp-in mt-3 inline-block rotate-[-3deg] rounded-sm border-2 px-2 py-0.5 text-sm font-bold uppercase tracking-widest ${v.className}`}
          >
            {v.label}
          </span>
          <p className="mt-4 text-lg">{c.a}</p>
          <p className="mt-4 rounded-md border border-line bg-paper-2/60 p-3 text-sm">
            <span className="smallcaps text-xs text-ink-2">Worst case · </span>
            {c.worst}
          </p>
        </div>
      </div>
    </div>
  )
}
