'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAccount } from 'wagmi'
import { short } from '@/lib/fmt'

/** The header's way into the account: "Account" when signed out, the wallet's short address when connected. */
export function AccountButton({ compact = false }: { compact?: boolean }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { address, isConnected } = useAccount()
  const here = usePathname()?.startsWith('/app')
  const connected = mounted && isConnected && address
  return (
    <Link
      href="/app"
      aria-current={here ? 'page' : undefined}
      className={`inline-flex min-h-10 items-center gap-2 rounded-[3px] border px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo ${here ? 'border-ink bg-ink text-paper' : 'border-ink/30 text-ink hover:border-ink'}`}
    >
      <PersonIcon />
      {connected ? (
        <>
          <span className="size-2 rounded-full bg-celadon" aria-hidden />
          <span className="font-mono">{short(address)}</span>
          <span className="sr-only">(your account)</span>
        </>
      ) : (
        !compact && <span>Account</span>
      )}
      {compact && !connected && <span className="sr-only">Account</span>}
    </Link>
  )
}

function PersonIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" />
    </svg>
  )
}
