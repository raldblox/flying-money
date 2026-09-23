'use client'
import { useRef, useState } from 'react'
import { Seal } from '@/components/seal'
import { buttonClass } from '@/components/section'
import { StatusChip } from '@/components/status-chip'
import { Tally } from '@/components/tally'
import { short, usdc } from '@/lib/fmt'

type Ev =
  | { type: 'start'; chain: string; chainName: string; explorer: string; face: string }
  | { type: 'info'; text: string; url?: string }
  | { type: 'issued'; certificateId: string; faceValue: string; expiresAt: string; txHash: string; txUrl: string }
  | { type: 'step'; text: string }
  | { type: 'sealed'; cumulative: string; requestId: string }
  | {
      type: 'accepted'
      path: string
      price: string
      status: string
      accepted: string
      consumed: string
      credit: string
    }
  | { type: 'redeemed'; paid: string; cumulative: string; txHash: string; txUrl: string }
  | {
      type: 'done'
      calls: number
      served: number
      consumed: string
      redeemed: string
      redemptions: number
      remaining: string
      certificateUrl: string
      bestTrade?: { buy: string; sell: string; margin: number }
    }
  | { type: 'error'; message: string }

type Phase = 'idle' | 'running' | 'done' | 'error'

export function DemoClient({ chainName }: { chainName: string }) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<Ev[]>([])
  const logRef = useRef<HTMLOListElement>(null)

  async function run() {
    setPhase('running')
    setError(null)
    setEvents([])
    try {
      const res = await fetch('/api/demo/run', { method: 'POST' })
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `The demo runner answered ${res.status}.`)
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += value
        const lines = buf.split('\n')
        buf = lines.pop() ?? ''
        for (const line of lines) {
          if (!line.trim()) continue
          const e = JSON.parse(line) as Ev
          setEvents((prev) => [...prev, e])
          if (e.type === 'error') {
            setError(e.message)
            setPhase('error')
          }
          if (e.type === 'done') setPhase('done')
          requestAnimationFrame(() => logRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest' }))
        }
      }
      setPhase((p) => (p === 'running' ? 'done' : p))
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  const start = events.find((e): e is Extract<Ev, { type: 'start' }> => e.type === 'start')
  const issued = events.find((e): e is Extract<Ev, { type: 'issued' }> => e.type === 'issued')
  const accepted = events.filter((e): e is Extract<Ev, { type: 'accepted' }> => e.type === 'accepted')
  const sealed = events.filter((e): e is Extract<Ev, { type: 'sealed' }> => e.type === 'sealed')
  const redeemed = events.filter((e): e is Extract<Ev, { type: 'redeemed' }> => e.type === 'redeemed')
  const done = events.find((e): e is Extract<Ev, { type: 'done' }> => e.type === 'done')
  const latest = accepted.at(-1)
  const redeemedTotal = redeemed.reduce((s, r) => s + BigInt(r.paid), 0n)
  const face = issued ? BigInt(issued.faceValue) : 0n
  const lines = events.filter(
    (e): e is Extract<Ev, { type: 'step' | 'info' }> => e.type === 'step' || e.type === 'info',
  )

  return (
    <div className="mt-8">
      <div className="flex flex-wrap items-center gap-4 sheet p-4">
        <p className="text-sm">
          Chain <strong>{chainName}</strong> · Budget <strong>0.30 USDC</strong> · 20 paid calls
        </p>
        <button type="button" onClick={run} disabled={phase === 'running'} className={buttonClass('primary')}>
          {phase === 'running' ? 'Running…' : phase === 'idle' ? 'Run the demo' : 'Run again'}
        </button>
        <p className="text-xs text-ink-2">Real testnet transactions. Every link opens the explorer.</p>
      </div>

      {error && (
        <div role="alert" className="mt-4 sheet border-l-4 border-seal p-5 text-sm">
          {error}
        </div>
      )}

      {phase === 'idle' && events.length === 0 && (
        <p className="mt-8 text-ink-2">
          Press <strong>Run the demo</strong>. A funder issues a fresh certificate on-chain for the Silk Road Oracle;
          the Merchant agent then makes 20 paid calls with sealed notes, and the Oracle redeems in a few transactions.
        </p>
      )}

      {events.length > 0 && (
        <>
          <div className="mt-6 grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
            <section aria-labelledby="merchant" className="sheet min-w-0">
              <h2 id="merchant" className="border-b border-line px-4 py-3 font-display text-xl font-semibold">
                Merchant (agent)
              </h2>
              <ol
                ref={logRef}
                className="h-80 overflow-y-auto p-4 font-mono text-xs leading-relaxed"
                aria-live="polite"
              >
                {lines.map((l, k) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the log is append-only, so an index never changes meaning
                  <li key={k} className={`break-words ${l.type === 'info' ? 'text-ink-2' : ''}`}>
                    {l.text}
                    {l.type === 'info' && l.url && (
                      <>
                        {' '}
                        <a className="text-indigo underline" href={l.url} target="_blank" rel="noreferrer">
                          tx ↗
                        </a>
                      </>
                    )}
                  </li>
                ))}
                {phase === 'running' && lines.length === 0 && (
                  <li className="text-ink-2">Issuing the certificate on-chain…</li>
                )}
              </ol>
            </section>

            <section aria-labelledby="road" className="sheet min-w-0">
              <h2 id="road" className="border-b border-line px-4 py-3 font-display text-xl font-semibold">
                The Road
              </h2>
              <ul className="flex h-80 flex-wrap content-start gap-2 overflow-y-auto p-4">
                {sealed.map((s) => (
                  <li
                    key={s.requestId}
                    className="note-in inline-flex items-center gap-1.5 rounded-full border border-seal/40 bg-paper-2 px-2.5 py-1 font-mono text-xs tabular-nums"
                  >
                    <span aria-hidden className="size-1.5 rounded-full bg-seal" />
                    sealed {usdc(s.cumulative)}
                  </li>
                ))}
                {sealed.length === 0 && <li className="text-sm text-ink-2">Sealed notes fly here, left to right.</li>}
              </ul>
            </section>

            <section aria-labelledby="oracle" className="sheet min-w-0">
              <h2 id="oracle" className="border-b border-line px-4 py-3 font-display text-xl font-semibold">
                Oracle (seller)
              </h2>
              <div className="h-80 overflow-y-auto p-4">
                <dl className="grid grid-cols-2 gap-y-2 text-sm">
                  <dt className="text-ink-2">Latest note accepted</dt>
                  <dd className="text-right font-mono tabular-nums">{latest ? usdc(latest.accepted) : '—'}</dd>
                  <dt className="text-ink-2">Served</dt>
                  <dd className="text-right font-mono tabular-nums">{latest ? usdc(latest.consumed) : '—'}</dd>
                  <dt className="text-ink-2">Redeemed on-chain</dt>
                  <dd className="text-right font-mono tabular-nums">{usdc(redeemedTotal)}</dd>
                </dl>
                {latest && (
                  <p className="mt-3 flex items-center gap-2">
                    <Seal size={28} animate key={latest.accepted} label="Note accepted" />
                    <StatusChip kind="accepted">Accepted by seller</StatusChip>
                  </p>
                )}
                <ul className="mt-4 space-y-2">
                  {redeemed.map((r) => (
                    <li key={r.txHash} className="flex items-center justify-between gap-2 text-sm">
                      <StatusChip kind="redeemed">Redeemed {usdc(r.paid)}</StatusChip>
                      <a
                        href={r.txUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs text-indigo underline"
                      >
                        {short(r.txHash)} ↗
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          </div>

          <section aria-labelledby="strip" className="mt-4 sheet p-5">
            <h2 id="strip" className="sr-only">
              Certificate
            </h2>
            {issued ? (
              <div className="grid items-center gap-4 md:grid-cols-[1fr_auto]">
                <Tally used={latest ? BigInt(latest.accepted) : 0n} face={face} label="signed" />
                <p className="text-sm">
                  <a className="text-indigo underline" href={`/c/${start?.chain}/${issued.certificateId}`}>
                    Certificate {short(issued.certificateId)}
                  </a>{' '}
                  ·{' '}
                  <a className="text-indigo underline" href={issued.txUrl} target="_blank" rel="noreferrer">
                    issue tx ↗
                  </a>
                </p>
              </div>
            ) : (
              <p className="h-10 animate-pulse rounded bg-paper-2 motion-reduce:animate-none">
                <span className="sr-only">Issuing the certificate…</span>
              </p>
            )}
          </section>

          {done && (
            <p className="mt-6 text-lg">
              <strong>
                {done.served} requests, {done.redemptions} redemption{done.redemptions === 1 ? '' : 's'}.
              </strong>{' '}
              The seller was paid {usdc(done.redeemed)} USDC for exactly what it served; {usdc(done.remaining)} USDC
              stays in the certificate and returns to the funder after expiry.
              {done.bestTrade && (
                <span className="text-ink-2">
                  {' '}
                  The Merchant’s best trade: buy tea in {done.bestTrade.buy}, sell in {done.bestTrade.sell}{' '}
                  (illustrative game data).
                </span>
              )}
            </p>
          )}
        </>
      )}
    </div>
  )
}
