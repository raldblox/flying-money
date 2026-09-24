'use client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

/** Re-renders a server page every few seconds while it is visible, so on-chain changes show up without a reload. */
export function AutoRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter()
  const [at, setAt] = useState<string | null>(null)
  useEffect(() => {
    setAt(new Date().toLocaleTimeString())
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      router.refresh()
      setAt(new Date().toLocaleTimeString())
    }, seconds * 1000)
    return () => clearInterval(t)
  }, [router, seconds])
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-2">
      <span className="size-1.5 animate-pulse rounded-full bg-celadon motion-reduce:animate-none" aria-hidden />
      Live{at ? ` · updated ${at}` : ''}
    </span>
  )
}
