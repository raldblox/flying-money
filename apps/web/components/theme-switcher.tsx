'use client'
import { useCallback, useEffect, useState } from 'react'

import { THEME_STORAGE_KEY as storageKey } from '@/lib/theme'

type Theme = 'system' | 'light' | 'dark'
const validTheme = (value: string | null): Theme => (value === 'light' || value === 'dark' ? value : 'system')

export function ThemeSwitcher() {
  const [theme, setTheme] = useState<Theme>('system')
  const [ready, setReady] = useState(false)
  const apply = useCallback((next: Theme) => {
    if (next === 'system') delete document.documentElement.dataset.theme
    else document.documentElement.dataset.theme = next
    setTheme(next)
  }, [])
  useEffect(() => {
    setTheme(validTheme(document.documentElement.getAttribute('data-theme')))
    setReady(true)
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) apply(validTheme(event.newValue))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [apply])

  useEffect(() => {
    // Keep mobile browser chrome consistent with an explicit choice, too.
    for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
      const dark = theme === 'dark' || (theme === 'system' && meta.media.includes('dark'))
      meta.content = dark ? '#15130f' : '#f4ede0'
    }
  }, [theme])

  return (
    <label
      title={`Color theme: ${theme}`}
      className="relative grid size-11 shrink-0 place-items-center rounded border border-ink/25 text-ink hover:border-ink focus-within:outline-2 focus-within:outline-indigo"
    >
      <span className="sr-only">Color theme</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="size-5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {theme === 'dark' ? (
          <path d="M20.5 13A8.5 8.5 0 0 1 11 3.5 8.5 8.5 0 1 0 20.5 13Z" />
        ) : theme === 'light' ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" />
          </>
        ) : (
          <>
            <rect x="3" y="4" width="18" height="13" rx="2" />
            <path d="M8 21h8m-4-4v4" />
          </>
        )}
      </svg>
      <select
        aria-label="Color theme"
        disabled={!ready}
        value={theme}
        onChange={(event) => {
          const next = validTheme(event.target.value)
          apply(next)
          try {
            if (next === 'system') localStorage.removeItem(storageKey)
            else localStorage.setItem(storageKey, next)
          } catch {
            /* The current page still switches when persistence is unavailable. */
          }
        }}
        className="absolute inset-0 size-full cursor-pointer opacity-0"
      >
        <option value="system">System theme</option>
        <option value="light">Light theme</option>
        <option value="dark">Dark theme</option>
      </select>
    </label>
  )
}
