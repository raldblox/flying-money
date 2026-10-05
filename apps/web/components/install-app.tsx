'use client'
import { useEffect, useState } from 'react'
import { buttonClass } from '@/components/section'

interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * Offers to install Flying Money as an app (it then opens offline and receives slips from the share menu). Browsers
 * that support it get a real install prompt; iPhone and iPad get the one-line Safari instruction; once installed,
 * nothing shows.
 */
export function InstallApp({ className = '' }: { className?: string }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [ios, setIos] = useState(false)
  const [installed, setInstalled] = useState(false)
  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true
    setInstalled(standalone)
    setIos(/iPhone|iPad|iPod/.test(navigator.userAgent))
    const onPrompt = (e: Event) => {
      e.preventDefault()
      setPrompt(e as InstallPrompt)
    }
    const onInstalled = () => {
      setInstalled(true)
      setPrompt(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])
  if (installed) return null
  if (prompt)
    return (
      <button
        type="button"
        className={`${buttonClass('secondary')} ${className}`}
        onClick={async () => {
          await prompt.prompt()
          if ((await prompt.userChoice).outcome === 'accepted') setPrompt(null)
        }}
      >
        Install the app (works offline)
      </button>
    )
  if (ios)
    return (
      <p className={`text-sm text-ink-2 ${className}`}>
        To use it offline as an app: tap Share, then <strong className="text-ink">Add to Home Screen</strong>.
      </p>
    )
  return null
}
