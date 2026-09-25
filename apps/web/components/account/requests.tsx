'use client'
import { useEffect, useState } from 'react'
import { short } from '@/lib/fmt'
import { listSeenRequests, type SeenRequest } from '@/lib/seen-requests'
import { useAccountCtx } from './context'

const STATUS: Record<SeenRequest['status'], { label: string; className: string }> = {
  waiting: { label: 'Waiting for you', className: 'border-amber/60 text-amber' },
  funded: { label: 'Funded', className: 'border-celadon/60 text-celadon' },
  declined: { label: 'Declined', className: 'border-line text-ink-2' },
}

/** Budget requests opened on this device, newest first; how agents ask. */
export function Requests() {
  const { chain, placeName } = useAccountCtx()
  const [list, setList] = useState<SeenRequest[] | null>(null)
  useEffect(() => {
    void listSeenRequests().then(setList)
  }, [])
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold">Requests</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        When your agent needs a budget, it sends you a link. Open it to review who asks, who could be paid, and how
        much. Nothing moves unless you fund it from your wallet.
      </p>
      {list === null ? null : list.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-line p-8 text-center">
          <p className="font-display text-2xl">No requests yet.</p>
          <p className="mt-1 text-ink-2">
            Requests you open on this device appear here. Your agent asks with the <code>fm_request_budget</code> tool.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid gap-2">
          {list.map((r) => {
            const s = STATUS[r.status]
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
                    {r.reason && <span className="mt-1 block truncate text-sm italic text-ink-2">“{r.reason}”</span>}
                  </span>
                  <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.className}`}>
                    {s.label}
                  </span>
                </a>
              </li>
            )
          })}
        </ul>
      )}
      <p className="mt-6 text-xs text-ink-2">Showing {chain.chain.name}. Requests are stored only on this device.</p>
    </div>
  )
}
