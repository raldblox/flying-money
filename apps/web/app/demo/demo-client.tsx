'use client'
import type { ChainKey } from '@flying-money/chains'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { Briefing } from '@/components/demo/briefing'
import { DemoStage } from '@/components/demo/demo-stage'
import { Journey } from '@/components/demo/journey'
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
  const [mode, setMode] = useState<'proposal' | 'illustration' | 'live'>('proposal')
  const [paused, setPaused] = useState(false)
  const [declined, setDeclined] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<DemoEvent[]>([])
  const [cutNetwork, setCutNetwork] = useState(false)
  const [stealKey, setStealKey] = useState(false)
  const [story, dispatch] = useReducer(
    (s: typeof initialStory, e: DemoEvent | null) => (e ? reduceStory(s, e) : initialStory),
    initialStory,
  )
  const illustration = useRef<DemoEvent[]>([])
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
            message: 'Sponsorship could not be checked. Check again or watch the illustration.',
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
  useEffect(() => {
    if (mode !== 'illustration' || paused) return
    const timer = setInterval(() => {
      const event = illustration.current.shift()
      if (event) dispatch(event)
      else setPaused(true)
    }, 850)
    return () => clearInterval(timer)
  }, [mode, paused])

  useEffect(() => {
    if (phase !== 'idle') document.getElementById('agent-progress')?.focus()
  }, [phase])
  function closeIllustration() {
    dispatch(null)
    for (const event of log) dispatch(event)
    setMode(log.length ? 'live' : 'proposal')
  }
  function illustrate() {
    dispatch(null)
    illustration.current = illustrationScript({ cutNetwork, stealKey })
    setMode('illustration')
    setPaused(false)
  }

  async function run() {
    if (runLock.current || !availability?.available) return
    runLock.current = true
    controller.current = new AbortController()
    setMode('live')
    setPhase('running')
    setDeclined(false)
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
    <div className="mt-7 grid gap-6 demo-experience">
      <Journey steps={steps} current={current} />
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
              ? `Your agent spent ${money(BigInt(done.consumed))} test USDC from its 0.30 USDC sponsored budget. You paid nothing yourself. Explore your briefing and save your keepsake below.`
              : (answers.at(-1)?.step ??
                'We supply the test funds and setup fees. Your personal wallet is not connected.')}
          </p>
          {recoverableId && (
            <p className="mt-2 text-xs text-ink-2">
              This tab can reconnect after refresh. Run records are kept for up to 24 hours; refreshing never approves
              another purchase.
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
        </section>
      )}
      <details className="demo-panel overflow-hidden" open={mode !== 'live'}>
        <summary className={`cursor-pointer p-4 font-medium ${mode !== 'live' ? 'hidden' : ''}`}>
          Your approved list & sponsored budget
        </summary>
        <section aria-labelledby="proposal-title">
          <div className="grid lg:grid-cols-[1.4fr_1fr]">
            <div className="p-5 sm:p-8">
              <p className="smallcaps text-xs text-ink-2">The agent proposes · you decide</p>
              <h2 id="proposal-title" className="mt-3 max-w-xl font-display text-3xl font-semibold sm:text-4xl">
                May I shop at the Oracle for you?
              </h2>
              <p className="mt-3 max-w-xl text-ink-2">
                I’ll buy this collection from the Silk Road Oracle and bring you a Silk Road briefing: the answers, a
                tea-price comparison, and a keepsake you can save.
              </p>
              <ul className="mt-5 divide-y divide-line border-y border-line">
                {shopping.map(([label, amount]) => (
                  <li key={label} className="flex justify-between gap-4 py-3 text-sm">
                    <span>{label}</span>
                    <span className="whitespace-nowrap font-mono">{amount} USDC</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-ink-2">
                Predefined shopping list · scripted agent. Tea prices and routes are fictional; weather comes from
                Open-Meteo. The keepsake includes a proverb.
              </p>
            </div>
            <div className="flex flex-col justify-between gap-5 border-t border-line bg-paper-2 p-5 sm:p-8 lg:border-t-0 lg:border-l">
              <div>
                <p className="smallcaps text-xs text-ink-2">Sponsored by Flying Money</p>
                <p className="mt-2 font-display text-5xl font-semibold">
                  0.30 <span className="text-xl">test USDC</span>
                </p>
                <p className="mt-1 text-sm">Budget limit · expected purchases 0.25 USDC</p>
                <dl className="mt-5 grid gap-3 text-sm">
                  <div>
                    <dt className="text-ink-2">Only allowed seller</dt>
                    <dd className="font-semibold">Silk Road Oracle</dd>
                  </div>
                  <div>
                    <dt className="text-ink-2">Budget lifetime</dt>
                    <dd>{issued ? utcDate(BigInt(issued.expiresAt)) : '7 days from funding'}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-2">Your cost</dt>
                    <dd className="font-semibold">Nothing. We supply the funds and setup fees.</dd>
                  </div>
                </dl>
              </div>
              <div className="grid gap-3">
                <p role="status" className="text-sm font-medium">
                  {active
                    ? issued
                      ? 'You approved the list. Your agent is buying it.'
                      : 'You approved the list. Preparing its sponsored budget…'
                    : phase === 'done'
                      ? 'Your agent has returned. Explore your briefing below.'
                      : declined
                        ? 'Not now. No purchases have been started.'
                        : phase === 'error'
                          ? 'This run stopped. Check its progress below.'
                          : 'Waiting for your permission. No purchases started.'}
                </p>
                {!active && (
                  <div className="text-sm" role="status">
                    <p>{availability?.message ?? 'Checking sponsored demo availability…'}</p>
                    {availability && !availability.available && (
                      <button
                        type="button"
                        className="mt-2 underline"
                        onClick={() => setAvailabilityCheck((n) => n + 1)}
                      >
                        Check availability again
                      </button>
                    )}
                  </div>
                )}
                <button
                  type="button"
                  className={buttonClass('primary')}
                  disabled={active || chains.length === 0 || !availability?.available}
                  onClick={() => void run()}
                >
                  {active
                    ? 'Agent at work…'
                    : phase === 'done' || phase === 'error'
                      ? 'Approve a new run'
                      : 'Approve these purchases'}
                </button>
                {phase === 'idle' && (
                  <button
                    type="button"
                    className={buttonClass('secondary')}
                    onClick={() => {
                      setDeclined(true)
                      setMode('proposal')
                    }}
                  >
                    Not now
                  </button>
                )}
                <p className="text-xs text-ink-2">
                  Approval starts this demo and funds its budget; it does not connect your wallet. Purchases then
                  proceed within the approved list. Unspent funds stay locked until expiry and return to the sponsor
                  when reclaimed.
                </p>
              </div>
            </div>
          </div>
        </section>
      </details>
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
            Existing answers and transaction links remain below. Starting another run creates a new sponsored budget.
          </p>
        </div>
      )}
      <details className="demo-panel p-4">
        <summary className="cursor-pointer font-medium">Network & optional experiments</summary>
        <fieldset disabled={active} className="mt-4 grid gap-4">
          <NetworkPicker
            networks={chains}
            value={chainKey}
            onChange={setChainKey}
            label="Test network"
            disabled={active}
          />
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={cutNetwork}
              onChange={(e) => setCutNetwork(e.target.checked)}
              className="mt-1"
            />
            <span>
              <strong>Interrupt the seller’s blockchain connection</strong>
              <br />A simulated connection failure: known budgets can still pay; collection waits.
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={stealKey}
              onChange={(e) => setStealKey(e.target.checked)}
              className="mt-1"
            />
            <span>
              <strong>Test a stolen spending key</strong>
              <br />
              Try to exceed the limit and pay another seller. A stolen key can still spend at the allowed seller.
            </span>
          </label>
        </fieldset>
      </details>
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
          <p className="mt-2 text-sm text-ink-2">
            Your approval covers the shopping list. The funded budget enforces the seller, amount and expiry; it cannot
            be cancelled early.
          </p>
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
          {issued && (
            <p className="mt-4 text-sm">
              <a className="text-indigo underline" href={issued.txUrl} target="_blank" rel="noreferrer">
                Budget setup transaction
              </a>{' '}
              · separate from seller collection
            </p>
          )}
          {done && (
            <p className="mt-3 text-sm">
              {money(BigInt(done.remaining))} USDC remains in the budget. The sponsor can reclaim what remains after
              expiry.
            </p>
          )}
          {statusUrl && (
            <a className="mt-3 inline-block text-sm text-indigo underline" href={statusUrl}>
              Inspect this budget
            </a>
          )}
        </section>
      )}
      {!active && (
        <div className="flex flex-wrap items-center gap-3">
          <button id="illustration" type="button" className={buttonClass('secondary')} onClick={illustrate}>
            Watch an illustration
          </button>
          <span className="text-sm text-ink-2">An optional walkthrough. No funds or purchases.</span>
        </div>
      )}
      {mode === 'illustration' && (
        <div className="flex flex-wrap items-center gap-3">
          <strong className="text-sm">Illustration · no live transactions</strong>
          <button type="button" className={buttonClass('secondary')} onClick={() => setPaused(!paused)}>
            {paused ? 'Resume illustration' : 'Pause illustration'}
          </button>
          <button type="button" className="text-sm underline" onClick={closeIllustration}>
            Close illustration
          </button>
        </div>
      )}
      {mode !== 'proposal' && (
        <details className="demo-panel p-4" open={mode === 'illustration'}>
          <summary className="cursor-pointer font-medium">Why it works: signed payments, then collection</summary>
          <div className={paused && mode === 'illustration' ? 'demo-paused mt-4' : 'mt-4'}>
            <DemoStage story={story} mode={mode === 'live' ? 'live' : 'illustration'} />
          </div>
        </details>
      )}
      {mode === 'live' && log.length > 0 && (
        <details className="demo-panel p-4 text-sm">
          <summary className="cursor-pointer font-medium">Verify it: payment events & transaction links</summary>
          <ol className="mt-3 max-h-96 overflow-auto divide-y divide-line">
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
        </details>
      )}
      {done && (
        <div className="flex flex-wrap gap-3">
          <a href="/docs/agents" className={buttonClass('primary')}>
            Give your own agent a budget
          </a>
        </div>
      )}
    </div>
  )
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
