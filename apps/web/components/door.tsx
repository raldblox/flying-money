'use client'
import { createContext, type ReactNode, useContext, useEffect, useState } from 'react'

/**
 * The landing page's two front doors (§3.7, §21.3): "For AI agents" and "For families & shops". The choice swaps
 * the hero, the problem and the how-it-works sections so one screen never mixes the two vocabularies. Remembered
 * on this device.
 */
export type DoorKey = 'agents' | 'people'
const KEY = 'fm-door'
const Ctx = createContext<{ door: DoorKey; setDoor: (d: DoorKey) => void }>({ door: 'agents', setDoor: () => {} })

export function DoorProvider({ children }: { children: ReactNode }) {
  const [door, set] = useState<DoorKey>('agents')
  useEffect(() => {
    try {
      const d = localStorage.getItem(KEY)
      if (d === 'agents' || d === 'people') set(d)
    } catch {}
  }, [])
  const setDoor = (d: DoorKey) => {
    set(d)
    try {
      localStorage.setItem(KEY, d)
    } catch {}
  }
  return <Ctx.Provider value={{ door, setDoor }}>{children}</Ctx.Provider>
}

export const useDoor = () => useContext(Ctx)

export function DoorToggle({ className = '' }: { className?: string }) {
  const { door, setDoor } = useDoor()
  return (
    <fieldset className={`inline-flex rounded-[4px] border border-ink/25 bg-paper/70 p-1 ${className}`}>
      <legend className="sr-only">Who is spending?</legend>
      {(
        [
          ['agents', 'For AI agents'],
          ['people', 'For families & shops'],
        ] as const
      ).map(([k, label]) => (
        <button
          key={k}
          type="button"
          aria-pressed={door === k}
          onClick={() => setDoor(k)}
          className={`min-h-10 rounded-[3px] px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo sm:px-4 ${door === k ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'}`}
        >
          {label}
        </button>
      ))}
    </fieldset>
  )
}

/**
 * Both variants occupy the same grid cell, and the inactive one is invisible, so the block is always as tall as the
 * taller variant: switching doors never moves anything below it.
 */
export function DoorStack({
  agents,
  people,
  className = '',
}: {
  agents: ReactNode
  people: ReactNode
  className?: string
}) {
  const { door } = useDoor()
  return (
    <div className={`grid ${className}`}>
      <div
        className={`col-start-1 row-start-1 ${door === 'agents' ? '' : 'invisible'}`}
        aria-hidden={door !== 'agents'}
      >
        {agents}
      </div>
      <div
        className={`col-start-1 row-start-1 ${door === 'people' ? '' : 'invisible'}`}
        aria-hidden={door !== 'people'}
      >
        {people}
      </div>
    </div>
  )
}

/** A whole section for one door; the other door's section is not rendered visibly. */
export function DoorOnly({
  door: which,
  children,
  inline = false,
}: {
  door: DoorKey
  children: ReactNode
  inline?: boolean
}) {
  const { door } = useDoor()
  return inline ? <span hidden={door !== which}>{children}</span> : <div hidden={door !== which}>{children}</div>
}
