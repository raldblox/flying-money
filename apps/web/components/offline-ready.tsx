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

/** Ask the active worker to verify its own cache, rather than guessing from registration alone. */
async function warmCache(worker: ServiceWorker): Promise<boolean> {
  return new Promise((resolve) => {
    const channel = new MessageChannel()
    const finish = (ready: boolean) => {
      clearTimeout(timeout)
      channel.port1.close()
      resolve(ready)
    }
    const timeout = setTimeout(() => finish(false), 30_000)
    channel.port1.onmessage = (event) => finish(event.data?.ready === true)
    const assets = performance
      .getEntriesByType('resource')
      .map((e) => e.name)
      .filter((url) => url.startsWith(`${location.origin}/_next/static/`))
    worker.postMessage({ type: 'CACHE_PAGE', page: location.href.split('#')[0], assets }, [channel.port2])
  })
}

export function OfflineReady() {
  const online = useOnline()
  const [ready, setReady] = useState(false)
  const [checked, setChecked] = useState(false)
  useEffect(() => {
    if (!online || !('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return
    let gone = false
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => (registration.active ? warmCache(registration.active) : false))
      .then((saved) => {
        if (!gone) {
          setReady(saved)
          setChecked(true)
        }
      })
      .catch(() => {
        if (!gone) setChecked(true)
      })
    return () => {
      gone = true
    }
  }, [online])
  return (
    <p className="smallcaps flex items-center gap-2 text-xs text-ink-2" role="status" aria-live="polite">
      <span aria-hidden className={`inline-block size-2 rounded-full ${online ? 'bg-celadon' : 'bg-amber'}`} />
      {online ? 'Online' : 'Offline'}
      {ready && <span>· this page is saved for offline use</span>}
      {checked && !ready && <span>· offline copy not confirmed; reopen this page when connected</span>}
    </p>
  )
}
