'use client'
import type { ChainKey } from '@flying-money/chains'
import { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { DemoStage } from '@/components/demo/demo-stage'
import { buttonClass } from '@/components/section'
import { usePreferredChain } from '@/lib/chain-param'
import { type DemoEvent, illustrationScript, initialStory, reduceStory, type Story } from '@/lib/demo-story'
import { short } from '@/lib/fmt'

type Phase = 'idle' | 'running' | 'done' | 'error'

/** How long each kind of event stays on screen, so the story is readable (ms). */
const PACE: Partial<Record<DemoEvent['type'], number>> = {
  start: 1600,
  issued: 2200,
  sealed: 260,
  accepted: 520,
  step: 420,
  redeemed: 1700,
  network: 3000,
  thief: 3200,
  done: 0,
  info: 0,
  error: 0,
}

type Action = { kind: 'event'; e: DemoEvent } | { kind: 'reset' }
const reducer = (s: Story, a: Action): Story => (a.kind === 'reset' ? initialStory : reduceStory(s, a.e))

/**
 * Plays events into the story at a readable pace. The live stream is queued as it arrives (a real chain can burst);
 * when a backlog builds up, the pace speeds up so the story never falls far behind.
 */
function usePacedStory() {
  const [story, dispatch] = useReducer(reducer, initialStory)
  const queue = useRef<DemoEvent[]>([])
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pump = useCallback(() => {
    if (timer.current) return
    const next = () => {
      const e = queue.current.shift()
      if (!e) {
        timer.current = null
        return
      }
      dispatch({ kind: 'event', e })
      const backlog = queue.current.length
      const base = PACE[e.type] ?? 300
      timer.current = setTimeout(next, backlog > 24 ? base / 4 : backlog > 8 ? base / 2 : base)
    }
    next()
  }, [])
  const push = useCallback(
    (e: DemoEvent) => {
      queue.current.push(e)
      pump()
    },
    [pump],
  )
  const reset = useCallback(() => {
    queue.current = []
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    dispatch({ kind: 'reset' })
  }, [])
  const idle = useCallback(() => queue.current.length === 0 && timer.current === null, [])
  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), [])
  return { story, push, reset, idle }
}

export function DemoClient({
  chains,
  defaultChain,
}: {
  chains: Array<{ key: ChainKey; name: string }>
  defaultChain: ChainKey
}) {
  const [chainKey, setChainKey] = usePreferredChain(
    chains.map((c) => c.key),
    defaultChain,
  )
  const chainName = chains.find((c) => c.key === chainKey)?.name ?? chainKey
  const [phase, setPhase] = useState<Phase>('idle')
  const [error, setError] = useState<string | null>(null)
  const [log, setLog] = useState<DemoEvent[]>([])
  const [cutNetwork, setCutNetwork] = useState(true)
  const [stealKey, setStealKey] = useState(true)
  const [mode, setMode] = useState<'illustration' | 'live'>('illustration')
  const { story, push, reset, idle } = usePacedStory()

  // Before a live run: play the labelled illustration in a loop, following the chosen toggles.
  useEffect(() => {
    if (mode !== 'illustration') return
    let stopped = false
    let wait: ReturnType<typeof setTimeout>
    const loop = () => {
      if (stopped) return
      reset()
      for (const e of illustrationScript({ cutNetwork, stealKey })) push(e)
      const check = () => {
        if (stopped) return
        if (idle()) wait = setTimeout(loop, 7000)
        else wait = setTimeout(check, 500)
      }
      wait = setTimeout(check, 500)
    }
    loop()
    return () => {
      stopped = true
      clearTimeout(wait)
    }
  }, [mode, cutNetwork, stealKey, push, reset, idle])

  const stageRef = useRef<HTMLDivElement>(null)

  async function run() {
    stageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setMode('live')
    reset()
    setPhase('running')
    setError(null)
    setLog([])
    try {
      const res = await fetch('/api/demo/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chain: chainKey, cutNetwork, stealKey }),
      })
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
          const e = JSON.parse(line) as DemoEvent
          push(e)
          setLog((prev) => [...prev, e])
          if (e.type === 'error') {
            setError(e.message)
            setPhase('error')
          }
          if (e.type === 'done') setPhase('done')
        }
      }
      setPhase((p) => (p === 'running' ? 'done' : p))
    } catch (e) {
      setError((e as Error).message)
      setPhase('error')
    }
  }

  function backToIllustration() {
    setPhase('idle')
    setError(null)
    setMode('illustration')
  }

  const issued = log.find((e): e is Extract<DemoEvent, { type: 'issued' }> => e.type === 'issued')
  const start = log.find((e): e is Extract<DemoEvent, { type: 'start' }> => e.type === 'start')
  const toggles = [
    {
      on: cutNetwork,
      set: setCutNetwork,
      label: 'Cut the network',
      hint: 'Halfway through, the seller loses its blockchain connection. Watch payments keep flowing.',
    },
    {
      on: stealKey,
      set: setStealKey,
      label: 'Steal the agent key',
      hint: 'At the end, a thief with the agent’s key tries three ways to take more.',
    },
  ]

  return (
    <div className="mt-8 grid gap-5">
      <div ref={stageRef} className="scroll-mt-4" />
      <DemoStage
        story={story}
        mode={mode}
        reserveThief={stealKey}
        action={
          mode === 'illustration' ? (
            <>
              <button type="button" onClick={run} className={buttonClass('primary')}>
                Now run it for real
              </button>
              <span className="text-sm text-ink-2">Same steps, on {chainName}, with transactions you can check.</span>
            </>
          ) : story.certificateUrl ? (
            <>
              <a href={story.certificateUrl} className={buttonClass('primary')}>
                See this budget on the blockchain
              </a>
              <a href="/docs/agents" className={buttonClass('secondary')}>
                Give your own agent a budget
              </a>
            </>
          ) : undefined
        }
      />
      <div className="sheet grid gap-4 p-4 sm:p-5">
        <h2 className="font-display text-2xl font-semibold">Run it yourself</h2>
        <div className="flex flex-wrap items-center gap-4">
          {/* a fixed width: the label changes during a run, the layout must not */}
          <button
            type="button"
            onClick={run}
            disabled={phase === 'running'}
            className={`${buttonClass('primary')} w-full sm:w-[17rem]`}
          >
            {phase === 'running' ? 'Running on the blockchain…' : phase === 'idle' ? 'Run it for real' : 'Run again'}
          </button>
          <p className="text-sm text-ink-2">
            {chains.length > 1 ? (
              <label>
                on{' '}
                <select
                  value={chainKey}
                  disabled={phase === 'running'}
                  onChange={(e) => setChainKey(e.target.value as ChainKey)}
                  className="rounded border border-line bg-paper px-2 py-1 font-semibold text-ink"
                >
                  {chains.map((c) => (
                    <option key={c.key} value={c.key}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                on <strong className="text-ink">{chainName}</strong>
              </>
            )}{' '}
            with test money: a real 0.30 USDC budget, 20 real paid calls, real transactions you can check.
          </p>
          {/* always laid out, hidden when not useful, so the row never re-wraps mid-film */}
          <button
            type="button"
            onClick={backToIllustration}
            className={`text-sm text-indigo underline ${mode === 'live' && phase !== 'running' ? '' : 'invisible'}`}
            aria-hidden={mode === 'live' && phase !== 'running' ? undefined : true}
            tabIndex={mode === 'live' && phase !== 'running' ? undefined : -1}
          >
            Back to the illustration
          </button>
        </div>
        <fieldset className="grid gap-3 sm:grid-cols-2" disabled={phase === 'running'}>
          <legend className="smallcaps mb-2 text-xs text-ink-2">Also show</legend>
          {toggles.map((t) => (
            <button
              key={t.label}
              type="button"
              aria-pressed={t.on}
              onClick={() => t.set(!t.on)}
              className={`flex min-h-11 flex-col items-start rounded border px-3 py-2 text-left disabled:opacity-60 ${t.on ? 'border-seal bg-paper-2' : 'border-ink/25'}`}
            >
              <span className="text-sm font-semibold">
                <span aria-hidden className="mr-1.5 text-seal">
                  {t.on ? '■' : '□'}
                </span>
                {t.label}
              </span>
              <span className="text-xs text-ink-2">{t.hint}</span>
            </button>
          ))}
        </fieldset>
        {/* below the stage, never above it: an error must not push the stage while someone is filming */}
        {error && (
          <div role="alert" className="border-l-4 border-seal bg-paper p-4 text-sm">
            <p>{error}</p>
            <button type="button" onClick={backToIllustration} className="mt-2 text-indigo underline">
              Watch the illustration instead
            </button>
          </div>
        )}
      </div>

      {mode === 'live' && log.length > 0 && (
        <details className="sheet p-4 text-sm">
          <summary className="cursor-pointer font-medium">Technical log and links</summary>
          <p className="mt-3 text-ink-2">
            Everything below happened on {start?.chainName ?? chainName}. Each link opens the public record.
          </p>
          {issued && (
            <p className="mt-2">
              <a className="text-indigo underline" href={`/c/${start?.chain}/${issued.certificateId}`}>
                Budget {short(issued.certificateId)}
              </a>{' '}
              ·{' '}
              <a className="text-indigo underline" href={issued.txUrl} target="_blank" rel="noreferrer">
                lock transaction ↗
              </a>
            </p>
          )}
          <ol className="mt-3 max-h-80 overflow-y-auto font-mono text-xs leading-relaxed">
            {log.map((e, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: an append-only log
              <li key={i} className="break-words border-b border-line/60 py-1">
                {describe(e)}
                {'txUrl' in e && e.txUrl && (
                  <>
                    {' '}
                    <a className="text-indigo underline" href={e.txUrl} target="_blank" rel="noreferrer">
                      tx ↗
                    </a>
                  </>
                )}
                {e.type === 'info' && e.url && (
                  <>
                    {' '}
                    <a className="text-indigo underline" href={e.url} target="_blank" rel="noreferrer">
                      tx ↗
                    </a>
                  </>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}

function describe(e: DemoEvent): string {
  switch (e.type) {
    case 'start':
      return `start: ${e.chainName}, budget ${e.face} base units`
    case 'issued':
      return `budget locked: ${e.certificateId}`
    case 'sealed':
      return `slip signed: total ${e.cumulative}`
    case 'accepted':
      return `${e.status} ${e.path}: accepted ${e.accepted}, served ${e.consumed}`
    case 'redeemed':
      return `collected ${e.paid} (up to total ${e.cumulative})`
    case 'step':
    case 'info':
      return e.text
    case 'network':
      return e.text
    case 'thief':
      return `thief: ${e.attempt} → ${e.detail}`
    case 'done':
      return `done: ${e.served}/${e.calls} served, collected ${e.redeemed}, ${e.redemptions} transactions`
    case 'error':
      return `error: ${e.message}`
  }
}
