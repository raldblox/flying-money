'use client'
import type { ChainKey } from '@flying-money/chains'
import { useId } from 'react'

export interface PickerNetwork {
  key: ChainKey
  /** short brand name ("Tempo") */
  brand: string
  /** full network name ("Tempo Testnet (Moderato)"), shown as a tooltip and read by screen readers */
  name: string
}

/**
 * Choose a network: one chip per network, built on native radio buttons (arrow keys move and select). Every network
 * gets the same weight; the order is the caller's (alphabetical by brand everywhere in the app).
 */
export function NetworkPicker({
  networks,
  value,
  onChange,
  label = 'Network',
  hideLabel = false,
  disabled = false,
  compact = false,
}: {
  networks: PickerNetwork[]
  value: ChainKey
  onChange: (k: ChainKey) => void
  label?: string
  hideLabel?: boolean
  disabled?: boolean
  /** one column of smaller chips (narrow sidebars) */
  compact?: boolean
}) {
  const name = useId()
  return (
    <fieldset disabled={disabled} className="min-w-0">
      <legend
        className={hideLabel ? 'sr-only' : `smallcaps mb-1.5 text-ink-2 ${compact ? 'text-[0.65rem]' : 'text-xs'}`}
      >
        {label}
      </legend>
      <div className={`grid gap-1.5 ${compact ? 'grid-cols-1' : 'grid-cols-2 sm:flex sm:flex-wrap'}`}>
        {networks.map((n) => {
          const on = n.key === value
          return (
            <label
              key={n.key}
              title={n.name}
              className="relative block cursor-pointer has-[:disabled]:cursor-not-allowed"
            >
              <input
                type="radio"
                name={name}
                value={n.key}
                checked={on}
                onChange={() => onChange(n.key)}
                aria-label={n.name}
                className="peer sr-only"
              />
              <span
                className={`flex items-center gap-2 rounded-full border font-medium transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo peer-disabled:opacity-60 ${
                  compact ? 'min-h-9 px-3 text-sm' : 'min-h-11 px-3.5 text-sm'
                } ${on ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink hover:border-ink/50'}`}
              >
                <span
                  aria-hidden
                  className={`grid size-2.5 shrink-0 place-items-center rounded-full ${on ? 'bg-paper' : 'border border-ink/40'}`}
                >
                  {on && <span className="size-1 rounded-full bg-ink" />}
                </span>
                <span className="truncate">{n.brand}</span>
                {!compact && (
                  <span
                    aria-hidden
                    className={`smallcaps hidden text-[0.6rem] sm:inline ${on ? 'text-paper/70' : 'text-ink-2'}`}
                  >
                    testnet
                  </span>
                )}
              </span>
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
