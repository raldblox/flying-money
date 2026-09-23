'use client'
import type { ChainConfig } from '@flying-money/chains'
import { useEffect, useState } from 'react'
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { buttonClass } from '@/components/section'
import { short } from '@/lib/fmt'

/** Connect / switch-network control for pages that send one transaction (e.g. the till's Collect). */
export function WalletButton({ chain }: { chain: ChainConfig }) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const { address, isConnected } = useAccount()
  const walletChainId = useChainId()
  const { connect, connectors, isPending, error } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switching } = useSwitchChain()
  if (!mounted) return null
  if (!isConnected)
    return (
      <div className="grid gap-2">
        {connectors.slice(0, 1).map((c) => (
          <button
            key={c.uid}
            type="button"
            onClick={() => connect({ connector: c })}
            disabled={isPending}
            className={buttonClass('secondary')}
          >
            {isPending ? 'Connecting…' : 'Connect wallet'}
          </button>
        ))}
        {error && (
          <p role="alert" className="text-sm text-seal">
            {/no provider|not found/i.test(error.message)
              ? 'No browser wallet found. Install MetaMask, Rabby or Coinbase Wallet.'
              : error.message.split('\n')[0]}
          </p>
        )}
      </div>
    )
  if (walletChainId !== chain.chain.id)
    return (
      <button
        type="button"
        className={buttonClass('secondary')}
        disabled={switching}
        onClick={() => switchChain({ chainId: chain.chain.id })}
      >
        Switch wallet to {chain.chain.name}
      </button>
    )
  return (
    <span className="flex items-center gap-3 text-sm">
      <span className="font-mono">{short(address!)}</span>
      <button type="button" onClick={() => disconnect()} className="text-indigo underline">
        Disconnect
      </button>
    </span>
  )
}
