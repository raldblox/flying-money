'use client'
import type { ChainKey } from '@flying-money/chains'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Briefing } from '@/components/demo/briefing'
import { DemoStage } from '@/components/demo/demo-stage'
import { Journey } from '@/components/demo/journey'
import { MoreDemos } from '@/components/demo/more-demos'
import { NetworkPicker, type PickerNetwork } from '@/components/network-picker'
import { buttonClass } from '@/components/section'
import { usePreferredChain } from '@/lib/chain-param'
import type { DemoRun } from '@/lib/demo-runs'
import { type DemoEvent, illustrationScript, initialStory, money, reduceStory } from '@/lib/demo-story'
import { utcDate } from '@/lib/fmt'

type Phase = 'idle' | 'running' | 'done' | 'error'

export function DemoClient({ chains, defaultChain }: { chains: PickerNetwork[]; defaultChain: ChainKey }) {
  const [chainKey, setChainKey] = usePreferredChain(
    chains.map((c) => c.key),
    defaultChain,
  )
  const chainName = chains.find((c) => c.key === chainKey)?.name ?? chainKey
  const [availability, setAvailability] = useState<{ available: boolean; message: string } | null>(null)
  const [availabilityCheck, setAvailabilityCheck] = useState(0)
  const [recoverableId, setRecoverableId] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('idle')
  const [mode, setMode] = useState<'proposal' | 'live'>('proposal')
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<DemoEvent[]>([])
  const [cutNetwork, setCutNetwork] = useState(false)
  const [stealKey, setStealKey] = useState(false)
  const [story, dispatch] = useReducer(
    (s: typeof initialStory, e: DemoEvent | null) => (e ? reduceStory(s, e) : initialStory),
    initialStory,
  )
  const runLock = useRef(false)
  const controller = useRef<AbortController | null>(null)
  useEffect(() => () => controller.current?.abort(), [])
  useEffect(() => {
    const abort = new AbortController()
    setAvailability(null)
    if (phase === 'running') return () => abort.abort()
    void fetch(`/api/demo/run?chain=${encodeURIComponent(chainKey)}&check=${availabilityCheck}`, {
      signal: abort.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error()
        return response.json()
      })
      .then((value) => {
        if (!abort.signal.aborted) setAvailability(value)
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setAvailability({
            available: false,
            message: 'The sponsored budget could not be checked right now. Please try again in a moment.',
          })
      })
    return () => abort.abort()
  }, [chainKey, phase, availabilityCheck])
  const followRun = useCallback(async (id: string, signal: AbortSignal) => {
    try {
      for (;;) {
        const response = await fetch(`/api/demo/run?runId=${encodeURIComponent(id)}`, { signal, cache: 'no-store' })
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? 'This run is unavailable or its 24-hour record has expired. This does not mean its purchases were cancelled.'
              : 'Connection lost. Your agent may still be shopping. Reconnect to this run to check its result.',
          )
        const record = (await response.json()) as DemoRun
        if (signal.aborted) return
        try {
          sessionStorage.setItem('fm-agent-snapshot', JSON.stringify({ id, record }))
        } catch {
          /* Server recovery remains available. */
        }
        setLog(record.events)
        dispatch(null)
        for (const event of record.events) dispatch(event)
        if (record.status !== 'running') {
          setPhase(record.status === 'done' ? 'done' : 'error')
          if (record.status === 'error')
            setError(record.events.filter((e) => e.type === 'error').at(-1)?.message ?? 'The run stopped.')
          if (record.status === 'interrupted')
            setError(
              'The runner stopped reporting. Some purchases may have completed. Review the saved evidence; reconnecting never starts new purchases.',
            )
          return
        }
        await new Promise<void>((resolve) => {
          const finish = () => {
            clearTimeout(timer)
            signal.removeEventListener('abort', finish)
            resolve()
          }
          const timer = setTimeout(finish, 1500)
          signal.addEventListener('abort', finish, { once: true })
        })
        if (signal.aborted) return
      }
    } catch (error) {
      if (!signal.aborted) {
        setError((error as Error).message)
        setPhase('error')
      }
    } finally {
      runLock.current = false
    }
  }, [])
  useEffect(() => {
    let saved: string | null = null
    try {
      saved = sessionStorage.getItem('fm-agent-run')
    } catch {
      return
    }
    if (!saved) return
    setRecoverableId(saved)
    try {
      const snapshot = JSON.parse(sessionStorage.getItem('fm-agent-snapshot') ?? 'null') as {
        id: string
        record: DemoRun
      } | null
      if (snapshot?.id === saved) {
        setLog(snapshot.record.events)
        for (const event of snapshot.record.events) dispatch(event)
      }
    } catch {
      /* A missing local snapshot does not prevent server recovery. */
    }
    setMode('live')
    setPhase('running')
    controller.current = new AbortController()
    void followRun(saved, controller.current.signal)
  }, [followRun])

  function reconnect() {
    if (!recoverableId) return
    controller.current?.abort()
    controller.current = new AbortController()
    setError(null)
    setPhase('running')
    void followRun(recoverableId, controller.current.signal)
  }
  // while you decide, the picture plays a labelled preview on a loop (no funds, no transactions); a twist changes it
  useEffect(() => {
    if (mode !== 'proposal') return
    dispatch(null)
    let queue = illustrationScript({ cutNetwork, stealKey })
    let rest = 0
    const timer = setInterval(() => {
      const event = queue.shift()
      if (event) {
        dispatch(event)
        return
      }
      rest += 1
      if (rest > 5) {
        rest = 0
        dispatch(null)
        queue = illustrationScript({ cutNetwork, stealKey })
      }
    }, 850)
    return () => clearInterval(timer)
  }, [mode, cutNetwork, stealKey])

  useEffect(() => {
    if (phase !== 'idle') document.getElementById('agent-progress')?.focus()
  }, [phase])
  async function run() {
    if (runLock.current || !availability?.available) return
    runLock.current = true
    controller.current = new AbortController()
    setMode('live')
    setPhase('running')
    setError(null)
    setLog([])
    dispatch(null)
    const runId = crypto.randomUUID()
    setRecoverableId(runId)
    try {
      sessionStorage.removeItem('fm-agent-snapshot')
      sessionStorage.setItem('fm-agent-run', runId)
      const response = await fetch('/api/demo/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ runId, chain: chainKey, cutNetwork, stealKey }),
        signal: controller.current.signal,
      })
      if (!response.ok) {
        const value = (await response.json().catch(() => ({}))) as { error?: string }
        sessionStorage.removeItem('fm-agent-run')
        setRecoverableId(null)
        throw new Error(value.error ?? 'The sponsored agent could not start. Check availability and try later.')
      }
      await followRun(runId, controller.current.signal)
    } catch (error) {
      if (!controller.current?.signal.aborted) {
        setError((error as Error).message)
        setPhase('error')
      }
    } finally {
      runLock.current = false
    }
  }

  const issued = log.find((e) => e.type === 'issued')
  const start = log.find((e) => e.type === 'start')
  const done = log.find((e) => e.type === 'done')
  const answers = log.filter((e) => e.type === 'answer')
  const statusUrl = issued && start ? `/c/${start.chain}/${issued.certificateId}` : undefined
  const active = phase === 'running'
  const steps = ['Your approval', 'Budget ready', 'Buying your list', 'Your briefing']
  const current = mode !== 'live' ? 0 : done ? 3 : issued ? 2 : 1
  const shopping = [
    ['8 city tea prices', '0.08'],
    ['4 current-weather reports', '0.04'],
    ['6 caravan route estimates', '0.12'],
    ['1 personal keepsake', '0.01'],
  ]

  return (
    <div className="mt-6 grid gap-5 demo-experience">
      <Journey steps={steps} current={current} />
      {mode === 'proposal' && (
        <section aria-labelledby="proposal-title" className="demo-panel overflow-hidden">
          <div className="grid lg:grid-cols-[1.35fr_1fr]">
            <div className="p-5 sm:p-7">
              <p className="smallcaps text-xs text-ink-2">The agent proposes · you decide</p>
              <h2 id="proposal-title" className="mt-2 max-w-xl font-display text-3xl font-semibold sm:text-4xl">
                May I shop at the Oracle for you?
              </h2>
              <p className="mt-2 max-w-xl text-ink-2">
                I’ll buy this list from the Silk Road Oracle and bring you a briefing and a keepsake.
              </p>
              <ul className="mt-4 divide-y divide-line border-y border-line">
                {shopping.map(([label, amount]) => (
                  <li key={label} className="flex justify-between gap-4 py-2.5 text-sm">
                    <span>{label}</span>
                    <span className="whitespace-nowrap font-mono">{amount} USDC</span>
                  </li>
                ))}
              </ul>
              <fieldset disabled={active} className="mt-5 grid gap-3">
                <NetworkPicker
                  networks={chains}
                  value={chainKey}
                  onChange={setChainKey}
                  label="Test network"
                  disabled={active}
                />
                <p className="smallcaps text-xs text-ink-2">Add a twist (optional) · the picture below shows it</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="flex items-start gap-3 rounded-md border border-line p-3 text-sm has-[:checked]:border-seal has-[:checked]:bg-seal/5">
                    <input
                      type="checkbox"
                      checked={cutNetwork}
                      onChange={(e) => setCutNetwork(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <strong>Cut the seller’s connection</strong>
                      <br />
                      <span className="text-ink-2">Known budgets still pay. Collection waits.</span>
                    </span>
                  </label>
                  <label className="flex items-start gap-3 rounded-md border border-line p-3 text-sm has-[:checked]:border-seal has-[:checked]:bg-seal/5">
                    <input
                      type="checkbox"
                      checked={stealKey}
                      onChange={(e) => setStealKey(e.target.checked)}
                      className="mt-1"
                    />
                    <span>
                      <strong>Steal the agent’s key</strong>
                      <br />
                      <span className="text-ink-2">A thief tries to overspend and to pay someone else.</span>
                    </span>
                  </label>
                </div>
              </fieldset>
            </div>
            <div className="flex flex-col justify-start gap-6 border-t border-line bg-paper-2 p-5 sm:p-7 lg:border-t-0 lg:border-l">
              <div>
                <p className="smallcaps text-xs text-ink-2">Sponsored by Flying Money</p>
                <p className="mt-2 font-display text-5xl font-semibold">
                  0.30 <span className="text-xl">test USDC</span>
                </p>
                <dl className="mt-4 grid gap-3 text-sm">
                  <div>
                    <dt className="text-ink-2">Only allowed seller</dt>
                    <dd className="font-semibold">Silk Road Oracle</dd>
                  </div>
                  <div>
                    <dt className="text-ink-2">Budget lifetime</dt>
                    <dd>7 days from funding. It can’t be cancelled early.</dd>
                  </div>
                  <div>
                    <dt className="text-ink-2">Your cost</dt>
                    <dd className="font-semibold">Nothing. We supply the funds and setup fees.</dd>
                  </div>
                </dl>
              </div>
              <div className="grid gap-3">
                <div className="text-sm" role="status">
                  <p>{availability?.message ?? 'Checking that the sponsored budget is available…'}</p>
                  {availability && !availability.available && (
                    <button type="button" className="mt-1 underline" onClick={() => setAvailabilityCheck((n) => n + 1)}>
                      Check again
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  className={buttonClass('primary')}
                  disabled={active || chains.length === 0 || !availability?.available}
                  onClick={() => void run()}
                >
                  Approve these purchases
                </button>
                <p className="text-xs text-ink-2">
                  Approving starts the demo and funds its budget. It never connects a wallet of yours.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}
      {mode === 'live' && (
        <section id="agent-progress" tabIndex={-1} className="demo-panel p-5 sm:p-7" aria-label="Agent progress">
          <p className="smallcaps text-xs text-ink-2">
            {done
              ? 'Your approved shopping trip is complete'
              : active
                ? 'Your agent is at work'
                : 'Your run needs attention'}
          </p>
          <h2 className="mt-2 font-display text-3xl font-semibold">
            {done
              ? `You approved. Your agent delivered ${done.served} of 19 purchases.`
              : phase === 'error'
                ? 'Check your saved run'
                : issued
                  ? 'Buying your approved list'
                  : 'Preparing your sponsored budget'}
          </h2>
          <p className="mt-3 text-sm text-ink-2">
            {done
              ? `Your agent spent ${money(BigInt(done.consumed))} test USDC of its 0.30 USDC sponsored budget. You paid nothing yourself.`
              : (answers.at(-1)?.step ?? 'We supply the test funds and setup fees. Your wallet is not connected.')}
          </p>
          {recoverableId && active && (
            <p className="mt-2 text-xs text-ink-2">
              You can refresh this page: it reconnects to the run, and never approves another purchase.
            </p>
          )}
          {active && (
            <>
              <progress
                className="mt-4 w-full accent-seal"
                aria-label="Approved purchases attempted"
                max={19}
                value={answers.length}
              />
              <p className="mt-1 text-sm" role="status">
                {answers.length} of 19 purchases attempted ·{' '}
                {answers.filter((a) => a.status >= 200 && a.status < 300).length} delivered
              </p>
            </>
          )}
          {!active && (
            <button
              type="button"
              className={`${buttonClass('secondary')} mt-4`}
              onClick={() => {
                try {
                  sessionStorage.removeItem('fm-agent-run')
                  sessionStorage.removeItem('fm-agent-snapshot')
                } catch {
                  /* nothing to clear */
                }
                setRecoverableId(null)
                setLog([])
                setError(null)
                setPhase('idle')
                setMode('proposal')
              }}
            >
              Run it again, with a twist
            </button>
          )}
        </section>
      )}
      {error && (
        <div role="alert" className="rounded border border-seal bg-paper p-4">
          <strong>This run needs attention</strong>
          <p className="mt-1 text-sm">{error}</p>
          {recoverableId && (
            <button type="button" className={`${buttonClass('secondary')} mt-3`} onClick={reconnect}>
              Reconnect to this run
            </button>
          )}
          <p className="mt-2 text-sm">
            We handle the seller’s collection for this demo, so there is nothing for you to fix. Reconnecting never
            starts a new purchase.
          </p>
        </div>
      )}

      {/* the picture: a looping preview while you decide, then the live run, always on screen */}
      <div className={paused(mode, phase) ? 'demo-paused' : undefined}>
        <DemoStage story={story} mode={mode === 'live' ? 'live' : 'illustration'} reserveThief={stealKey} />
      </div>

      {mode === 'live' && (answers.length > 0 || done) && (
        <Briefing
          answers={answers}
          done={done}
          stopped={phase === 'error'}
          network={start?.chainName ?? chainName}
          statusUrl={statusUrl}
        />
      )}
      {mode === 'live' && (
        <section className="demo-panel p-5" aria-label="Payment record">
          <h2 className="font-display text-2xl font-semibold">Your payment record</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              ['Delivered', String(story.calls)],
              ['Spent', `${money(story.served)} USDC`],
              ['Collected', `${money(story.collected)} USDC`],
              ['Collection transactions', String(story.collections.length)],
            ].map(([label, value]) => (
              <div key={label}>
                <p className="text-xs text-ink-2">{label}</p>
                <p className="mt-1 font-display text-2xl font-semibold">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-ink-2">
            {issued && (
              <>
                <a className="text-indigo underline" href={issued.txUrl} target="_blank" rel="noreferrer">
                  Budget setup transaction
                </a>{' '}
                ·{' '}
              </>
            )}
            {statusUrl && (
              <>
                <a className="text-indigo underline" href={statusUrl}>
                  Inspect this budget
                </a>{' '}
                ·{' '}
              </>
            )}
            {done
              ? `${money(BigInt(done.remaining))} USDC remains; the sponsor can reclaim it after expiry.`
              : 'The seller collects what it served, in batches.'}
          </p>
          {log.filter((e) => e.type !== 'answer').length > 0 && (
            <ol className="mt-4 max-h-72 overflow-auto divide-y divide-line border-t border-line text-sm">
              {log
                .filter((e) => e.type !== 'answer')
                .map((e, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: append-only event log
                  <li key={i} className="break-words py-2">
                    {describe(e)}
                    {'txUrl' in e && e.txUrl && (
                      <>
                        {' '}
                        <a href={e.txUrl} className="text-indigo underline" target="_blank" rel="noreferrer">
                          View transaction
                        </a>
                      </>
                    )}
                    {e.type === 'info' && e.url && (
                      <>
                        {' '}
                        <a href={e.url} className="text-indigo underline" target="_blank" rel="noreferrer">
                          View setup transaction
                        </a>
                      </>
                    )}
                  </li>
                ))}
            </ol>
          )}
        </section>
      )}
      <MoreDemos current="agent" />
    </div>
  )
}

/** The picture is only frozen when a live run has stopped; the preview and a running demo always move. */
function paused(mode: 'proposal' | 'live', phase: Phase) {
  return mode === 'live' && phase !== 'running' && phase !== 'idle'
}

function describe(e: DemoEvent): string {
  switch (e.type) {
    case 'start':
      return `Preparing a sponsored budget on ${e.chainName}.`
    case 'issued':
      return `Budget funded: ${money(BigInt(e.faceValue))} USDC, valid until ${utcDate(BigInt(e.expiresAt))}.`
    case 'sealed':
      return `Payment slip signed: cumulative total ${money(BigInt(e.cumulative))} USDC.`
    case 'accepted':
      return `${e.status === 'SERVED' ? 'Delivered' : 'Failed; credit recorded'}: ${e.path}, price ${money(BigInt(e.price))} USDC.`
    case 'redeemed':
      return `Seller collected ${money(BigInt(e.paid))} USDC.`
    case 'step':
    case 'info':
    case 'network':
      return e.text
    case 'thief':
      return `${e.attempt}: ${e.detail}`
    case 'done':
      return `${e.served}/${e.calls} delivered, ${e.redemptions} seller collection transactions.`
    case 'error':
      return e.message
    case 'answer':
      return e.step
  }
}
