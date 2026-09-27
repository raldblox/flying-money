'use client'
import { useState } from 'react'
import { useCertificates } from '@/components/app/certificate-lists'
import { BudgetRow, type BudgetState, budgetState } from './budget-row'
import { useAccountCtx } from './context'

const FILTERS: Array<{ key: 'all' | BudgetState; label: string }> = [
  { key: 'active', label: 'Active' },
  { key: 'ending', label: 'Ending soon' },
  { key: 'ended', label: 'Ended' },
  { key: 'closed', label: 'Closed' },
  { key: 'all', label: 'All' },
]

/** Every budget you funded, filterable by state, each with its actions in place. */
export function BudgetsList() {
  const { chain, refreshKey, refresh } = useAccountCtx()
  const q = useCertificates(chain, 'funder', refreshKey)
  const [filter, setFilter] = useState<'all' | BudgetState>('active')
  const certs = q.data ?? []
  const count = (k: 'all' | BudgetState) =>
    k === 'all' ? certs.length : certs.filter((c) => budgetState(c) === k).length
  const shown = filter === 'all' ? certs : certs.filter((c) => budgetState(c) === filter)
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold">Budgets</h1>
      <fieldset className="mt-5 flex flex-wrap gap-2">
        <legend className="sr-only">Filter budgets</legend>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            aria-pressed={filter === f.key}
            onClick={() => setFilter(f.key)}
            className={`min-h-10 rounded-full border px-4 text-sm font-medium ${filter === f.key ? 'border-ink bg-ink text-paper' : 'border-line text-ink-2 hover:border-ink hover:text-ink'}`}
          >
            {f.label}
            <span className="ml-1.5 opacity-70">{count(f.key)}</span>
          </button>
        ))}
      </fieldset>
      {q.isPending ? (
        <div className="mt-4 grid gap-2" aria-busy="true">
          {[0, 1, 2, 3].map((k) => (
            <div key={k} className="h-24 animate-pulse rounded-md bg-paper-2 motion-reduce:animate-none" />
          ))}
        </div>
      ) : q.isError ? (
        <p role="alert" className="mt-4 text-seal">
          Couldn’t read your budgets from the chain.{' '}
          <button type="button" onClick={() => void q.refetch()} className="text-indigo underline">
            Try again
          </button>
        </p>
      ) : shown.length === 0 ? (
        <p className="mt-6 rounded-md border border-dashed border-line p-8 text-center text-ink-2">
          {filter === 'ended'
            ? 'No ended budgets waiting: nothing to take back.'
            : filter === 'active'
              ? 'No active budgets right now.'
              : 'Nothing here.'}
        </p>
      ) : (
        <ul className="mt-4 grid gap-2">
          {shown.map((c) => (
            <BudgetRow key={c.id} cert={c} onChanged={refresh} />
          ))}
        </ul>
      )}
    </div>
  )
}
