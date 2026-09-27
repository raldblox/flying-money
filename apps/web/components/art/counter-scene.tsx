'use client'
import { useEffect, useRef, useState } from 'react'
import { BrandMark } from '@/components/brand-mark'

const FRAMES = [
  { till: 'price', phone: 'idle', caption: 'The till shows the price as a code.' },
  { till: 'price', phone: 'scan', caption: 'Mia scans it with her phone.' },
  { till: 'price', phone: 'confirm', caption: 'She checks the amount and enters her PIN.' },
  { till: 'scan', phone: 'code', caption: 'Her phone shows a payment code. The till scans it.' },
  { till: 'ok', phone: 'done', caption: 'Accepted in milliseconds. Regulars can pay even with the Wi‑Fi off.' },
] as const

/**
 * At the counter (§6.8), as a short looping scene: the till and Mia's phone, frame by frame. It advances only while on
 * screen; the step buttons let visitors go at their own pace (which also stops the loop).
 */
export function CounterScene() {
  const [f, setF] = useState(0)
  const [auto, setAuto] = useState(true)
  const [visible, setVisible] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), { threshold: 0.4 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!auto || !visible) return
    const t = setInterval(() => setF((x) => (x + 1) % FRAMES.length), f === FRAMES.length - 1 ? 3600 : 2300)
    return () => clearInterval(t)
  }, [auto, visible, f])
  const frame = FRAMES[f]!
  return (
    <div ref={root} className="grid gap-5">
      <div className="grid grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] items-end gap-4 sm:gap-8">
        <Till state={frame.till} />
        <Phone state={frame.phone} />
      </div>
      <p className="min-h-[3.5rem] text-center font-display text-2xl font-semibold sm:text-3xl" aria-live="polite">
        <span key={f} className="caption-in inline-block">
          {frame.caption}
        </span>
      </p>
      <ol className="flex justify-center gap-2">
        {FRAMES.map((x, k) => (
          <li key={x.caption}>
            <button
              type="button"
              aria-label={`Step ${k + 1}: ${x.caption}`}
              aria-pressed={k === f}
              onClick={() => {
                setF(k)
                setAuto(false)
              }}
              className="grid h-6 w-10 place-items-center focus-visible:outline-2 focus-visible:outline-indigo"
            >
              <span className={`h-1.5 w-full rounded-full transition-colors ${k <= f ? 'bg-seal' : 'bg-line'}`} />
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Till({ state }: { state: 'price' | 'scan' | 'ok' }) {
  return (
    <div className="rounded-2xl border-4 border-ink/80 bg-paper p-3 shadow-[var(--sheet-shadow)] sm:p-4">
      <div className="flex items-center justify-between text-xs text-ink-2">
        <span className="smallcaps">Lantern Café · till</span>
        <span className="flex items-center gap-1 rounded-sm border border-amber px-1.5 text-amber">
          <WifiOff /> offline
        </span>
      </div>
      <div className="relative mt-3 grid min-h-44 place-items-center rounded-lg bg-paper-2 p-3 sm:min-h-56">
        {state === 'ok' ? (
          <div key="ok" className="caption-in text-center">
            <span className="stamp-in inline-block">
              <BrandMark size={64} />
            </span>
            <p className="mt-2 font-display text-3xl font-semibold text-seal">Accepted</p>
            <p className="font-mono text-lg tabular-nums">3.50 USDC</p>
            <p className="mt-1 text-xs text-ink-2">Paid from money set aside for this café.</p>
          </div>
        ) : (
          <div key="price" className="grid w-full grid-cols-[auto_1fr] items-center gap-3 sm:gap-5">
            <FakeQr seed={7} className="size-24 sm:size-32" scanning={false} />
            <div>
              <p className="text-sm text-ink-2">Tea</p>
              <p className="font-display text-4xl font-semibold tabular-nums lining-nums sm:text-5xl">3.50</p>
              <p className="text-xs text-ink-2">USDC · scan to pay</p>
              {state === 'scan' && (
                <p className="caption-in mt-2 text-xs font-medium text-indigo">Scanning Mia’s code…</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Phone({ state }: { state: 'idle' | 'scan' | 'confirm' | 'code' | 'done' }) {
  return (
    <div className="mx-auto w-full max-w-[12.5rem] rounded-[2rem] border-4 border-ink/80 bg-paper p-2.5 shadow-[var(--sheet-shadow)]">
      <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-ink/30" />
      <div className="grid min-h-60 place-items-center rounded-2xl bg-paper-2 p-3 text-center sm:min-h-72">
        {state === 'idle' && (
          <div key="idle" className="caption-in">
            <p className="smallcaps text-[0.65rem] text-ink-2">Mia’s wallet</p>
            <p className="mt-1 font-mono text-xl tabular-nums">20.00</p>
            <p className="text-[0.7rem] text-ink-2">at Lantern Café</p>
            <span className="mt-4 inline-block rounded bg-seal-button px-4 py-1.5 text-sm font-semibold text-on-seal">
              Pay
            </span>
          </div>
        )}
        {state === 'scan' && (
          <div key="scan" className="caption-in relative">
            <FakeQr seed={7} className="size-28" scanning />
            <p className="mt-2 text-xs text-ink-2">Scanning the price…</p>
          </div>
        )}
        {state === 'confirm' && (
          <div key="confirm" className="caption-in w-full">
            <p className="text-xs text-ink-2">Pay Lantern Café</p>
            <p className="font-display text-3xl font-semibold tabular-nums lining-nums">3.50</p>
            <p className="text-[0.7rem] text-ink-2">left after: 16.50</p>
            <div className="mt-3 flex justify-center gap-1.5" role="img" aria-label="PIN entered">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <span
                  key={i}
                  className="pin-dot size-2.5 rounded-full bg-ink"
                  style={{ animationDelay: `${i * 160}ms` }}
                />
              ))}
            </div>
          </div>
        )}
        {state === 'code' && (
          <div key="code" className="caption-in">
            <FakeQr seed={31} className="size-32" scanning={false} />
            <p className="mt-2 text-xs text-ink-2">Show this to the till</p>
          </div>
        )}
        {state === 'done' && (
          <div key="done" className="caption-in">
            <p className="text-4xl text-ink">✓</p>
            <p className="mt-1 text-sm font-medium">Paid 3.50</p>
            <p className="font-mono text-lg tabular-nums">16.50 left</p>
          </div>
        )}
      </div>
    </div>
  )
}

/** A decorative code: a deterministic pattern with the three finder squares, never a real, scannable QR. */
function FakeQr({ seed, className, scanning }: { seed: number; className: string; scanning: boolean }) {
  const n = 21
  const cells: Array<[number, number]> = []
  let x = seed
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff
      const finder = (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7)
      if (!finder && x % 3 === 0) cells.push([r, c])
    }
  const finder = (r: number, c: number) => (
    <g key={`${r}-${c}`} transform={`translate(${c} ${r})`}>
      <rect width="7" height="7" fill="var(--ink)" />
      <rect x="1" y="1" width="5" height="5" fill="var(--paper)" />
      <rect x="2" y="2" width="3" height="3" fill="var(--ink)" />
    </g>
  )
  return (
    <span className={`relative inline-block ${className}`}>
      <svg viewBox={`-1 -1 ${n + 2} ${n + 2}`} className="size-full" aria-hidden shapeRendering="crispEdges">
        <rect x="-1" y="-1" width={n + 2} height={n + 2} fill="var(--paper)" />
        {cells.map(([r, c]) => (
          <rect key={`${r}.${c}`} x={c} y={r} width="1" height="1" fill="var(--ink)" />
        ))}
        {finder(0, 0)}
        {finder(0, n - 7)}
        {finder(n - 7, 0)}
      </svg>
      {scanning && <span className="scan-line absolute inset-x-0 top-0 h-0.5 bg-seal shadow-[0_0_8px_var(--seal)]" />}
    </span>
  )
}

function WifiOff() {
  return (
    <svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M2 8.5a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0" />
      <path d="M3 3l18 18" />
    </svg>
  )
}
