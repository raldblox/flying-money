'use client'
import { useEffect, useState } from 'react'

/** Registers the offline shell (public/sw.js) and shows whether this device is online. */
export function useOnline() {
  const [online, setOnline] = useState(true)
  useEffect(() => {
    setOnline(navigator.onLine)
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])
  return online
}

/** Must match CACHE in public/sw.js. */
const SHELL_CACHE = 'fm-shell-v2'

/**
 * On the very first visit this page loaded before the service worker controlled it, so its own page and scripts are
 * not cached yet. Add them now (same-origin build assets only), so the next visit works offline.
 */
async function warmCache() {
  const c = await caches.open(SHELL_CACHE)
  const assets = performance
    .getEntriesByType('resource')
    .map((e) => e.name)
    .filter((u) => u.startsWith(`${location.origin}/_next/static/`))
  await Promise.all(
    assets.map(async (a) => {
      if (!(await c.match(a))) await c.add(a).catch(() => {})
    }),
  )
  const page = location.pathname + location.search
  if (!(await c.match(page))) await c.add(page).catch(() => {})
}

export function OfflineReady() {
  const online = useOnline()
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => navigator.serviceWorker.ready)
      .then(() => warmCache())
      .then(() => setReady(true))
      .catch(() => {})
  }, [])
  return (
    <p className="smallcaps flex items-center gap-2 text-xs text-ink-2" role="status" aria-live="polite">
      <span aria-hidden className={`inline-block size-2 rounded-full ${online ? 'bg-celadon' : 'bg-amber'}`} />
      {online ? 'Online' : 'Offline'}
      {ready && <span>· works offline on this device</span>}
    </p>
  )
}
