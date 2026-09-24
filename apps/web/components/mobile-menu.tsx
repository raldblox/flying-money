'use client'
import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

/** The header menu below the md breakpoint: a fixed panel that never changes the header's layout. */
export function MobileMenu({ items }: { items: Array<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div ref={root}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen(!open)}
        className="grid size-11 place-items-center rounded border border-ink/25 focus-visible:outline-2 focus-visible:outline-indigo"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      <nav id={id} aria-label="Main" hidden={!open} className="sheet fixed inset-x-4 top-24 z-50 p-2">
        <ul className="grid">
          {items.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                onClick={() => setOpen(false)}
                className="smallcaps flex min-h-12 items-center rounded px-4 text-base text-ink hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-indigo"
              >
                {n.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  )
}
