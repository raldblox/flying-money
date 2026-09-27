'use client'
import { type ReactNode, useEffect, useRef, useState } from 'react'
import { MoneyFlow } from '@/components/art/money-flow'

export interface ExplorerStep {
  /** a rendered icon (elements, not components, can cross from a server page to this client component) */
  icon: ReactNode
  t: string
  d: string
  /** which moment of the money flow this step shows */
  flow: 0 | 1 | 2 | 3 | 4
}

/**
 * The landing page's "how it works": the steps as a list you can click through, next to the money-flow picture of the
 * selected step. It advances on its own while on screen, until the visitor picks a step.
 */
export function StepExplorer({ steps, cast }: { steps: ExplorerStep[]; cast: 'agents' | 'people' }) {
  const [active, setActive] = useState(0)
  const [auto, setAuto] = useState(true)
  // reduced motion: never advance by itself (§22.5 h)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setAuto(false)
  }, [])
  const [visible, setVisible] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = root.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setVisible(Boolean(e?.isIntersecting)), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!auto || !visible) return
    const t = setInterval(() => setActive((a) => (a + 1) % steps.length), 4200)
    return () => clearInterval(t)
  }, [auto, visible, steps.length])
  const current = steps[active]!
  return (
    <div ref={root} className="grid items-center gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <ol className="grid gap-2" aria-label="Steps">
        {steps.map(({ icon, t, d }, k) => {
          const on = k === active
          return (
            <li key={t}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => {
                  setActive(k)
                  setAuto(false)
                }}
                className={`group relative flex w-full gap-4 overflow-hidden rounded-md border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-indigo ${on ? 'border-seal bg-paper-2' : 'border-transparent hover:border-line'}`}
              >
                <span
                  className={`relative grid size-14 shrink-0 place-items-center rounded-full bg-paper ring-1 ${on ? 'text-seal ring-seal' : 'text-ink ring-line'}`}
                >
                  <span className="[&>svg]:size-9">{icon}</span>
                  <span
                    className="absolute -right-1 -top-1 grid size-6 place-items-center rounded-[3px] bg-seal font-han text-xs text-paper"
                    lang="zh-Hant"
                    aria-hidden
                  >
                    {['一', '二', '三', '四', '五'][k]}
                  </span>
                </span>
                <span className="min-w-0">
                  <span className="block font-display text-2xl font-semibold">{t}</span>
                  <span className={`block text-ink-2 ${on ? '' : 'line-clamp-1 sm:line-clamp-none'}`}>{d}</span>
                </span>
                {on && auto && visible && (
                  <span
                    key={active}
                    className="step-timer absolute inset-x-0 bottom-0 h-0.5 origin-left bg-seal"
                    aria-hidden
                  />
                )}
              </button>
            </li>
          )
        })}
      </ol>
      <figure className="sheet relative p-3 sm:p-4">
        <button
          type="button"
          onClick={() => setAuto(!auto)}
          className="absolute right-3 top-3 z-10 min-h-9 rounded-[3px] border border-ink/25 bg-paper px-3 text-xs font-medium hover:border-ink focus-visible:outline-2 focus-visible:outline-indigo"
        >
          {auto ? 'Pause' : 'Play'}
        </button>
        <MoneyFlow step={current.flow} cast={cast} className="w-full" />
        <figcaption className="sr-only" aria-live={auto ? 'off' : 'polite'}>
          Step {active + 1}: {current.t}. {current.d}
        </figcaption>
      </figure>
    </div>
  )
}
