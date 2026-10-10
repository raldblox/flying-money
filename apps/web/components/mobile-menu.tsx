'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

/** The header menu below the desktop breakpoint: an overlaid panel that never changes the header's layout. */
export function MobileMenu({ items }: { items: Array<{ href: string; label: string }> }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const pathname = usePathname()
  const trigger = useRef<HTMLButtonElement>(null)
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        trigger.current?.focus()
      }
    }
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    const onFocus = (e: FocusEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener('focusin', onFocus)
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('focusin', onFocus)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  return (
    <div ref={root}>
      <button
        ref={trigger}
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
      <nav
        id={id}
        aria-label="Main"
        hidden={!open}
        className="sheet absolute inset-x-4 top-full z-50 max-h-[calc(100dvh-6rem)] overflow-y-auto p-2 shadow-xl sm:left-auto sm:w-80"
      >
        <ul className="grid">
          {items.map((n) => (
            <li key={n.href}>
              <Link
                href={n.href}
                aria-current={pathname === n.href ? 'page' : undefined}
                onClick={() => setOpen(false)}
                className="smallcaps flex min-h-12 items-center rounded px-4 text-base text-ink hover:bg-paper-2 aria-[current=page]:bg-paper-2 aria-[current=page]:text-seal focus-visible:outline-2 focus-visible:outline-indigo"
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
