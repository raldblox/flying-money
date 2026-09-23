'use client'
import { getChain } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { useEffect, useState } from 'react'
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { IssuedList, PayeeList } from '@/components/app/certificate-lists'
import { IssueWizard, type Place } from '@/components/app/issue-wizard'
import { buttonClass } from '@/components/section'
import { short } from '@/lib/fmt'
import { SITE } from '@/lib/site'
import { deployedChains } from '@/lib/wagmi'

type Tab = 'issue' | 'issued' | 'redeem'

export function CountingHouse({ defaultChain, oraclePayee }: { defaultChain: string; oraclePayee?: Hex }) {
  const chains = deployedChains()
  const [showMainnets, setShowMainnets] = useState(false)
  const visible = chains.filter((c) => showMainnets || !c.mainnet)
  const [chainKey, setChainKey] = useState(
    visible.find((c) => c.key === defaultChain)?.key ?? visible[0]?.key ?? 'arbitrum-sepolia',
  )
  const chain = getChain(chainKey)
  const [tab, setTab] = useState<Tab>('issue')
  const [refreshKey, setRefreshKey] = useState(0)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const { address, isConnected } = useAccount()
  const walletChainId = useChainId()
  const { connect, connectors, isPending, error: connectError } = useConnect()
  const { disconnect } = useDisconnect()
  const { switchChain, isPending: switching } = useSwitchChain()
  const wrongNetwork = isConnected && walletChainId !== chain.chain.id

  const places: Place[] = oraclePayee ? [{ name: 'Silk Road Oracle (demo)', address: oraclePayee, verified: true }] : []

  return (
    <div className="mt-8 grid gap-8">
      {/* Mode banner (§12.1) */}
      <div className={`sheet p-4 text-sm ${chain.mainnet ? 'border-l-4 border-seal' : ''}`}>
        {chain.mainnet ? (
          <p>
            <strong>{SITE.mainnetMode}</strong>. Deployment-wide cap 1,000 USDC.
          </p>
        ) : (
          <p>
            <strong>Test money only.</strong> Get test USDC from{' '}
            {chain.faucets.map((f) => (
              <a key={f} href={f} className="text-indigo underline" target="_blank" rel="noreferrer">
                {f.replace('https://', '')}
              </a>
            ))}{' '}
            and a little {chain.gasToken} for gas on {chain.chain.name}.
          </p>
        )}
      </div>

      {/* Connect + chain */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <label htmlFor="chain" className="smallcaps block text-sm text-ink-2">
            Chain
          </label>
          <select
            id="chain"
            value={chainKey}
            onChange={(e) => setChainKey(e.target.value as typeof chainKey)}
            className="mt-1 min-h-11 rounded-[3px] border border-ink/25 bg-paper px-3 font-medium focus-visible:outline-2 focus-visible:outline-indigo"
          >
            {visible.map((c) => (
              <option key={c.key} value={c.key}>
                {c.chain.name} {c.mainnet ? '(real money)' : '(testnet)'}
              </option>
            ))}
          </select>
          <label className="ml-4 inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showMainnets}
              onChange={(e) => setShowMainnets(e.target.checked)}
              className="accent-[var(--seal)]"
            />
            Show mainnets (real money)
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {!mounted ? null : isConnected ? (
            <>
              <span className="font-mono text-sm">{short(address!)}</span>
              <button type="button" onClick={() => disconnect()} className={buttonClass('secondary')}>
                Disconnect
              </button>
            </>
          ) : (
            connectors.slice(0, 1).map((c) => (
              <button
                key={c.uid}
                type="button"
                onClick={() => connect({ connector: c })}
                disabled={isPending}
                className={buttonClass('primary')}
              >
                {isPending ? 'Connecting…' : 'Connect wallet'}
              </button>
            ))
          )}
        </div>
      </div>
      {connectError && (
        <p role="alert" className="text-sm text-seal">
          {/no provider|not found/i.test(connectError.message)
            ? 'No browser wallet found. Install MetaMask, Rabby or Coinbase Wallet, then try again.'
            : connectError.message.split('\n')[0]}
        </p>
      )}
      {wrongNetwork && (
        <div role="alert" className="sheet flex flex-wrap items-center gap-4 border-l-4 border-seal p-4">
          <p>Your wallet is on another network.</p>
          <button
            type="button"
            className={buttonClass('primary')}
            disabled={switching}
            onClick={() => switchChain({ chainId: chain.chain.id })}
          >
            Switch to {chain.chain.name}
          </button>
        </div>
      )}

      {!mounted || !isConnected ? (
        <div className="sheet p-10 text-center">
          <p className="font-display text-3xl font-semibold">Connect a wallet to open the Counting House.</p>
          <p className="mt-2 text-ink-2">
            Paying for someone? Issue a certificate. Being paid? Collect the slips you received.
          </p>
        </div>
      ) : (
        <>
          <div role="tablist" aria-label="Counting House" className="flex flex-wrap gap-2 border-b-2 border-seal/50">
            {(
              [
                ['issue', 'Issue a certificate'],
                ['issued', 'Certificates you issued'],
                ['redeem', 'Certificates you can redeem'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={tab === k}
                onClick={() => setTab(k)}
                className={`-mb-0.5 min-h-11 border-b-2 px-4 font-display text-lg font-semibold ${tab === k ? 'border-seal text-ink' : 'border-transparent text-ink-2 hover:text-ink'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {wrongNetwork ? (
              <p className="text-ink-2">Switch networks to continue.</p>
            ) : tab === 'issue' ? (
              <IssueWizard chain={chain} places={places} onIssued={() => setRefreshKey((k) => k + 1)} />
            ) : tab === 'issued' ? (
              <IssuedList chain={chain} refreshKey={refreshKey} />
            ) : (
              <PayeeList chain={chain} refreshKey={refreshKey} />
            )}
          </div>
        </>
      )}
    </div>
  )
}
