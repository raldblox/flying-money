'use client'
import { useEffect, useState } from 'react'

export function GiftForward() {
  const [missing, setMissing] = useState(false)
  useEffect(() => {
    if (window.location.hash.includes('add=')) window.location.replace(`/wallet${window.location.hash}`)
    else setMissing(true)
  }, [])
  return missing ? (
    <p className="mt-4 text-ink-2">
      This link has no certificate in it. Ask the sender for the full link, or open your{' '}
      <a className="text-indigo underline" href="/wallet">
        wallet
      </a>
      .
    </p>
  ) : null
}
