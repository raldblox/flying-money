'use client'
import type { Certificate } from '@flying-money/core'
import Link from 'next/link'
import { useState } from 'react'
import { FunderActions } from '@/components/app/funder-actions'
import { savePlace } from '@/lib/contacts'
import { relTime, short, usdc } from '@/lib/fmt'
import { useAccountCtx } from './context'

export type BudgetState = 'active' | 'ending' | 'ended' | 'closed'

export function budgetState(c: Certificate, now = BigInt(Math.floor(Date.now() / 1000))): BudgetState {
  if (c.closed) return 'closed'
  if (now > c.expiresAt) return 'ended'
  if (c.expiresAt - now < 2n * 86_400n) return 'ending'
  return 'active'
}

const BADGE: Record<BudgetState, { label: string; className: string }> = {
  active: { label: 'Active', className: 'border-celadon/60 text-celadon' },
  ending: { label: 'Ending soon', className: 'border-amber/60 text-amber' },
  ended: { label: 'Ended · take back', className: 'border-seal/60 text-seal' },
  closed: { label: 'Closed', className: 'border-line text-ink-2' },
}

/** One budget as a row: where, for whom, how much is left, and when it ends. Actions open in place. */
export function BudgetRow({ cert, onChanged }: { cert: Certificate; onChanged: () => void }) {
  const { chain, placeName, holderName, isKnownPlace, refresh } = useAccountCtx()
  const [open, setOpen] = useState(false)
  const [naming, setNaming] = useState(false)
  const [newName, setNewName] = useState('')
  const saved = isKnownPlace(cert.payee)
  const state = budgetState(cert)
  const left = cert.faceValue - cert.redeemed
  const pct = cert.faceValue > 0n ? Number((cert.redeemed * 1000n) / cert.faceValue) / 10 : 0
  const who = holderName(cert.spender, cert.id)
  const place = placeName(cert.payee)
  const b = BADGE[state]
  return (
    <li className="rounded-md border border-line bg-paper transition-colors hover:border-ink/40">
      <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 p-4">
        <span
          className="grid size-11 place-items-center rounded-full bg-paper-2 font-display text-xl font-semibold text-ink"
          aria-hidden
        >
          {place.startsWith('0x') ? '◎' : place[0]}
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={`/c/${chain.key}/${cert.id}`}
              className={`truncate font-semibold text-ink hover:underline focus-visible:outline-2 focus-visible:outline-indigo ${
                saved ? '' : 'font-mono'
              }`}
            >
              {place}
            </Link>
            {!saved && (
              <span className="shrink-0 rounded-full border border-amber/60 px-2 py-0.5 text-[0.7rem] font-medium text-amber">
                Not saved
              </span>
            )}
          </div>
          <p className="truncate text-sm text-ink-2">
            for {who ?? <span className="font-mono">{short(cert.spender)}</span>} ·{' '}
            {state === 'closed'
              ? 'closed'
              : state === 'ended'
                ? `ended ${relTime(cert.expiresAt)}`
                : `ends ${relTime(cert.expiresAt)}`}
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-paper-2" aria-hidden>
            <div className="h-full rounded-full bg-celadon" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg tabular-nums">
            {usdc(state === 'closed' ? cert.redeemed : left)}
            <span className="text-sm text-ink-2"> / {usdc(cert.faceValue)}</span>
          </p>
          <p className="text-xs text-ink-2">{state === 'closed' ? 'spent' : 'left'}</p>
          <span
            className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[0.7rem] font-medium ${b.className}`}
          >
            {b.label}
          </span>
        </div>
      </div>
      {!saved &&
        (naming ? (
          <form
            className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-2"
            onSubmit={(e) => {
              e.preventDefault()
              const name = newName.trim()
              if (!name) return
              void savePlace({ name, chain: chain.key, payee: cert.payee, verification: 'unverified' }).then(() => {
                setNaming(false)
                refresh()
              })
            }}
          >
            <label className="sr-only" htmlFor={`name-${cert.id}`}>
              Name for {short(cert.payee)}
            </label>
            <input
              id={`name-${cert.id}`}
              autoComplete="off"
              placeholder="e.g. Weather API"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="min-h-9 min-w-0 flex-1 rounded-[3px] border border-ink/25 bg-paper px-2 text-sm focus-visible:outline-2 focus-visible:outline-indigo"
            />
            <button type="submit" className="min-h-9 text-sm font-medium text-indigo hover:underline">
              Save
            </button>
            <button
              type="button"
              onClick={() => setNaming(false)}
              className="min-h-9 text-sm text-ink-2 hover:underline"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="border-t border-line px-4 py-2">
            <button
              type="button"
              onClick={() => setNaming(true)}
              className="min-h-9 text-sm font-medium text-indigo hover:underline"
            >
              Save as a place…
            </button>
            <span className="ml-2 text-xs text-ink-2">Give this address a name so you can recognise it next time.</span>
          </div>
        ))}
      {state !== 'closed' && (
        <div className="border-t border-line px-4 py-2">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen(!open)}
            className="min-h-9 text-sm font-medium text-indigo hover:underline"
          >
            {open ? 'Hide actions' : state === 'ended' ? `Take back ${usdc(left)} USDC…` : 'Top up or extend…'}
          </button>
          {open && (
            <div className="pb-2">
              <FunderActions
                chain={chain}
                cert={cert}
                onDone={() => {
                  setOpen(false)
                  onChanged()
                }}
              />
            </div>
          )}
        </div>
      )}
    </li>
  )
}
