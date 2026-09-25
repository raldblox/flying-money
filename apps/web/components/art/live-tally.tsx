'use client'
import { type CSSProperties, useEffect, useRef, useState } from 'react'
import { TallyArt } from './tally'

/**
 * The hero's budget card, alive: it leans toward the pointer, pays for things on its own (the balance counts down as
 * slips fly off to the one place it works), refuses an overspend with a stamp, and gets its leftovers back at the
 * end. Amounts are integer cents of USDC (display only). Under prefers-reduced-motion it is a still card with the
 * same controls.
 */
export interface LiveTallyProps {
  face: number
  payee: string
  holder: string
  expires: string
  /** what gets bought, and its price in cents */
  items: ReadonlyArray<readonly [string, number]>
  /** the loop ends (leftovers come back) once less than this is left, in cents */
  floor: number
}

const fmt = (c: number) => `${Math.floor(c / 100)}.${String(c % 100).padStart(2, '0')}`
type Flying = { id: number; label: string; cents: number }

export function LiveTally({ face, payee, holder, expires, items, floor }: LiveTallyProps) {
  const [left, setLeft] = useState(face)
  const [shown, setShown] = useState(face) // the number on the card, counting toward `left`
  const [flying, setFlying] = useState<Flying[]>([])
  const [log, setLog] = useState<Flying[]>([])
  const [phase, setPhase] = useState<'paying' | 'ending' | 'refused'>('paying')
  const [reduced, setReduced] = useState(false)
  const [visible, setVisible] = useState(true)
  const wrap = useRef<HTMLDivElement>(null)
  const seq = useRef(0)
  const nextItem = useRef(0)

  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(m.matches)
    // a still card still tells the story: a few payments already made
    if (m.matches) {
      const spent = items.slice(0, 3)
      const l = face - spent.reduce((a, [, c]) => a + c, 0)
      setLeft(l)
      setShown(l)
      setLog(spent.map(([label, cents], i) => ({ id: i, label, cents })).reverse())
    }
  }, [face, items])

  // only animate while on screen and the tab is visible
  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting) && !document.hidden))
    io.observe(el)
    const onVis = () => setVisible(!document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  // the agent (or Mia) pays for something every so often
  useEffect(() => {
    if (reduced || !visible || phase !== 'paying') return
    const t = setTimeout(
      () => {
        const [label, cents] = items[nextItem.current % items.length]!
        if (left - cents < floor) {
          setPhase('ending')
          return
        }
        nextItem.current++
        const f = { id: ++seq.current, label, cents }
        setLeft((l) => l - cents)
        setFlying((xs) => [...xs, f])
        setLog((xs) => [f, ...xs].slice(0, 3))
        setTimeout(() => setFlying((xs) => xs.filter((x) => x.id !== f.id)), 1400)
      },
      seq.current === 0 ? 1400 : 1900,
    )
    return () => clearTimeout(t)
  }, [reduced, visible, phase, left, items, floor])

  // the end date: leftovers go back, then a fresh budget
  useEffect(() => {
    if (phase !== 'ending') return
    const t = setTimeout(() => {
      setLeft(face)
      setLog([])
      setPhase('paying')
    }, 3200)
    return () => clearTimeout(t)
  }, [phase, face])

  // count the big number toward `left` (from wherever it is now)
  const shownRef = useRef(face)
  useEffect(() => {
    const set = (v: number) => {
      shownRef.current = v
      setShown(v)
    }
    if (reduced) return set(left)
    let raf = 0
    const from = shownRef.current
    const start = performance.now()
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / 550)
      const e = 1 - (1 - k) ** 3
      set(Math.round(from + (left - from) * e))
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [left, reduced])

  const overspend = () => {
    if (phase === 'refused') return
    const before = phase
    setPhase('refused')
    setTimeout(() => setPhase(before === 'ending' ? 'ending' : 'paying'), 1800)
  }

  // lean toward the pointer (fine pointers only)
  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    const s = e.currentTarget.style
    s.setProperty('--ry', `${(x - 0.5) * 10}deg`)
    s.setProperty('--rx', `${(0.5 - y) * 8}deg`)
    s.setProperty('--mx', `${x * 100}%`)
    s.setProperty('--my', `${y * 100}%`)
    s.setProperty('--shine', '1')
  }
  const onLeave = (e: React.PointerEvent<HTMLDivElement>) => {
    const s = e.currentTarget.style
    s.setProperty('--ry', '0deg')
    s.setProperty('--rx', '0deg')
    s.setProperty('--shine', '0')
  }

  const status =
    phase === 'refused'
      ? `Refused: more than the ${fmt(left)} left. Nothing was paid.`
      : phase === 'ending'
        ? `Ended. ${fmt(left)} USDC goes back to the giver.`
        : `Pays only ${payee}. ${fmt(left)} of ${fmt(face)} left.`

  return (
    <div ref={wrap} className="live-tally">
      <div
        className="live-tally-card relative"
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        style={{ '--rx': '0deg', '--ry': '0deg', '--mx': '50%', '--my': '50%', '--shine': '0' } as CSSProperties}
      >
        <div className={phase === 'refused' && !reduced ? 'tally-shake' : ''}>
          <TallyArt
            face={fmt(face)}
            left={fmt(shown)}
            payee={payee}
            holder={holder}
            expires={expires}
            className="w-full drop-shadow-[0_18px_30px_rgb(60_40_10/0.22)]"
          />
        </div>
        {/* a soft sheen that follows the pointer */}
        <div aria-hidden className="live-tally-shine pointer-events-none absolute inset-[4%] rounded-sm" />

        {/* slips flying off to the one place this budget works */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          {flying.map((f) => (
            <span
              key={f.id}
              className="slip-fly absolute left-[46%] top-[40%] whitespace-nowrap rounded-[3px] border border-seal bg-paper px-2 py-1 font-mono text-xs text-ink shadow-sm"
            >
              −{fmt(f.cents)} · {f.label}
            </span>
          ))}
        </div>

        {phase === 'refused' && (
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="stamp-in -rotate-12 rounded-md border-4 border-seal px-5 py-1 font-display text-4xl font-bold tracking-widest text-seal sm:text-5xl">
              REFUSED
            </span>
          </div>
        )}
        {phase === 'ending' && (
          <div aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center">
            <span className="rise rounded-full border border-celadon bg-paper px-4 py-2 text-sm font-semibold text-ink shadow-sm">
              ↩ {fmt(left)} back to the giver
            </span>
          </div>
        )}
      </div>

      {/* what just happened, newest first; a fixed height so nothing below ever moves */}
      <div className="mt-3 flex h-28 flex-col gap-1.5 overflow-hidden" aria-hidden>
        {log.map((f, i) => (
          <div
            key={f.id}
            className={`note-in flex items-center justify-between rounded-[3px] border border-line bg-paper/80 px-3 py-1 text-sm ${i ? 'opacity-60' : ''}`}
          >
            <span className="truncate text-ink-2">
              <span className="text-celadon">✓</span> {f.label} <span className="text-ink-2/80">· {payee}</span>
            </span>
            <span className="font-mono tabular-nums text-ink">−{fmt(f.cents)}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex min-h-[4.75rem] flex-wrap items-start justify-between gap-2 sm:min-h-11 sm:items-center">
        <p className="min-w-0 flex-1 text-sm text-ink-2">{status}</p>
        {/* announce only what a click caused, not every automatic payment */}
        <p role="status" className="sr-only">
          {phase === 'refused' ? status : ''}
        </p>
        <button
          type="button"
          onClick={overspend}
          className="min-h-10 rounded-[3px] border border-seal/60 px-3 text-sm font-medium text-seal transition-colors hover:bg-seal hover:text-on-seal focus-visible:outline-2 focus-visible:outline-indigo"
        >
          Try to overspend
        </button>
      </div>
    </div>
  )
}
