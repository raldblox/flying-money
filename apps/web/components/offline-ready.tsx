'use client'
import { requestBackgroundRecovery } from '@flying-money/browser/background'
import { protectStorage, storageHealth } from '@flying-money/browser/storage-health'
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
  const [protectedStorage, setProtectedStorage] = useState(false)
  const [storageMessage, setStorageMessage] = useState('')
  const [update, setUpdate] = useState(false)
  useEffect(() => {
    void storageHealth().then((health) => setProtectedStorage(health.persisted))
  }, [])
  useEffect(() => {
    if (!online || !('serviceWorker' in navigator) || process.env.NODE_ENV !== 'production') return
    let gone = false
    navigator.serviceWorker
      .register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then((registration) => {
        const inspect = () => {
          if (!gone) setUpdate(Boolean(registration.waiting))
        }
        inspect()
        registration.addEventListener('updatefound', () =>
          registration.installing?.addEventListener('statechange', inspect),
        )
        void requestBackgroundRecovery()
        return navigator.serviceWorker.ready
      })
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
    <div className="grid gap-2">
      <p className="smallcaps flex items-center gap-2 text-xs text-ink-2" role="status" aria-live="polite">
        <span aria-hidden className={`inline-block size-2 rounded-full ${online ? 'bg-celadon' : 'bg-amber'}`} />
        {online ? 'Online' : 'Offline'}
        {ready && <span>· this page is saved for offline use</span>}
        {checked && !ready && <span>· offline copy not confirmed; reopen this page when connected</span>}
      </p>
      {ready && (
        <details className="text-xs text-ink-2">
          <summary className="min-h-8 cursor-pointer">Offline storage &amp; updates</summary>
          <div className="grid max-w-lg gap-2 py-2">
            <p>
              Saved payments are checked when you reconnect or reopen the app. Supported browsers can also check in the
              background. Collection still needs your approval.
            </p>
            <p>
              {protectedStorage
                ? 'This browser has granted persistent storage.'
                : 'This browser may clear local data when space is low. Keep an encrypted wallet backup.'}
            </p>
            {!protectedStorage && (
              <button
                type="button"
                className="min-h-10 w-fit text-indigo underline"
                onClick={async () => {
                  const granted = await protectStorage()
                  setProtectedStorage(granted)
                  setStorageMessage(
                    granted
                      ? 'Storage protection granted.'
                      : 'This browser did not grant protection. Keep a backup and avoid clearing site data.',
                  )
                }}
              >
                Protect saved data
              </button>
            )}
            <p>
              Add Flying Money to your home screen using your browser’s install or share menu. Open your wallet and till
              online once before going offline.
            </p>
            {storageMessage && <p role="status">{storageMessage}</p>}
          </div>
        </details>
      )}
      {update && (
        <p role="status" className="text-xs text-ink-2">
          An update is ready. Finish your current payment, close all Flying Money tabs, then reopen to update.
        </p>
      )}
    </div>
  )
}
