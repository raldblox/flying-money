'use client'
import { type ChainKey, isChainKey } from '@flying-money/chains'
import { useEffect, useState } from 'react'

const KEY = 'fm-chain'

/**
 * Chain preselection (§21.2): `?chain=<registry key>` wins and is remembered on this device; otherwise the remembered
 * choice; otherwise `fallback`. Only keys in `allowed` are ever returned.
 */
export function usePreferredChain(allowed: ChainKey[], fallback: ChainKey): [ChainKey, (k: ChainKey) => void] {
  const allowedList = allowed.join(',')
  const [chain, setChain] = useState<ChainKey>(allowed.includes(fallback) ? fallback : (allowed[0] ?? fallback))
  useEffect(() => {
    const ok = (k: string | null): k is ChainKey => k !== null && isChainKey(k) && allowedList.split(',').includes(k)
    const fromUrl = new URLSearchParams(window.location.search).get('chain')
    let remembered: string | null = null
    try {
      remembered = localStorage.getItem(KEY)
    } catch {}
    if (ok(fromUrl)) {
      setChain(fromUrl)
      try {
        localStorage.setItem(KEY, fromUrl)
      } catch {}
    } else if (ok(remembered)) setChain(remembered)
  }, [allowedList])
  const choose = (k: ChainKey) => {
    setChain(k)
    try {
      localStorage.setItem(KEY, k)
    } catch {}
  }
  return [chain, choose]
}
