'use client'
import type { ChainKey } from '@flying-money/chains'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { type ReactNode, useEffect, useState } from 'react'
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from 'wagmi'
import { buttonClass } from '@/components/section'
import { TestNote } from '@/components/test-note'
import { short } from '@/lib/fmt'
import { useInbox } from '@/lib/use-inbox'
import { e2eMode } from '@/lib/wagmi'
import { hasBrowserWallet, walletAppLinks } from '@/lib/wallet-apps'
import { useAccountCtx } from './context'

const NAV = [
  { href: '/app', label: 'Home', icon: 'home' },
  { href: '/app/budgets', label: 'Budgets', icon: 'budget' },
  { href: '/app/requests', label: 'Requests', icon: 'inbox' },
  { href: '/app/collect', label: 'Collect', icon: 'collect' },
  { href: '/app/people', label: 'People & agents', icon: 'people' },
  { href: '/app/places', label: 'Sellers', icon: 'place' },
] as const

/**
 * The account area: one navigation for everything a person, agent owner or shop does with their money, the network
 * (with its test-money notice, §20), and the wallet. Pages render inside it.
 */
export function AccountShell({ children }: { children: ReactNode }) {
  const path = usePathname() ?? '/app'
  const active = (href: string) => (href === '/app' ? path === '/app' : path.startsWith(href))
  // how many budget requests wait in the inbox (when this browser is signed in to it)
  const inbox = useInbox()
  return (
    <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-10 lg:py-10">
      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start">
        <nav aria-label="Account" className="-mx-4 overflow-x-auto px-4 lg:mx-0 lg:overflow-visible lg:px-0">
          <ul className="flex gap-1 lg:grid">
            {NAV.map((n) => (
              <li key={n.href} className="shrink-0">
                <Link
                  href={n.href}
                  aria-current={active(n.href) ? 'page' : undefined}
                  className={`flex min-h-11 items-center gap-3 whitespace-nowrap rounded-md px-3 text-[0.95rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo ${active(n.href) ? 'bg-ink text-paper' : 'text-ink-2 hover:bg-paper-2 hover:text-ink'}`}
                >
                  <NavIcon name={n.icon} />
                  {n.label}
                  {n.href === '/app/requests' && inbox.waiting > 0 && (
                    <>
                      <span
                        aria-hidden
                        className="ml-auto grid min-w-5 place-items-center rounded-full bg-seal-button px-1.5 text-xs font-semibold text-on-seal"
                      >
                        {inbox.waiting}
                      </span>
                      <span className="sr-only">, {inbox.waiting} waiting</span>
                    </>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <Link href="/app/give" className={`${buttonClass('primary')} mt-4 w-full`}>
          + Give a budget
        </Link>
        <NetworkNote />
      </aside>
      <div className="min-w-0">
        {/* at phone widths the sidebar's network note is off-screen: say it here (§22.4) */}
        <TestNote className="mb-4 lg:hidden" />
        <WalletGate>{children}</WalletGate>
      </div>
    </div>
  )
}

function NetworkNote() {
  const { chain, chains, setChainKey } = useAccountCtx()
  return (
    <div className="mt-6 hidden rounded-md border border-line p-3 text-xs text-ink-2 lg:block">
      <label className="smallcaps block text-[0.65rem]" htmlFor="account-network">
        Network
      </label>
      {chains.length > 1 ? (
        <select
          id="account-network"
          value={chain.key}
          onChange={(e) => setChainKey(e.target.value as ChainKey)}
          className="mt-1 w-full rounded border border-line bg-paper px-2 py-1 text-sm text-ink"
        >
          {chains.map((c) => (
            <option key={c.key} value={c.key}>
              {c.chain.name}
            </option>
          ))}
        </select>
      ) : (
        <p className="mt-1 text-sm text-ink">{chain.chain.name}</p>
      )}
      <p className="mt-2">Test money only. Not audited.</p>
    </div>
  )
}

/** Connect first, then the right network; pages only render for a connected wallet on the account's network. */
function WalletGate({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false)
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    setMounted(true)
    const t = setTimeout(() => setSlow(true), 3000)
    return () => clearTimeout(t)
  }, [])
  const { chain } = useAccountCtx()
  const { address, isConnected, isReconnecting, isConnecting } = useAccount()
  const walletChainId = useChainId()
  const { connect, connectors, isPending, error } = useConnect()
  const { switchChain, isPending: switching } = useSwitchChain()
  const path = usePathname() ?? ''
  // contacts are local to this device, and connecting an assistant only needs an address: they work without a wallet
  const needsWallet = !['/app/people', '/app/places', '/app/connect'].some((p) => path.startsWith(p))

  // never an empty placeholder for more than 3 s (§22.10 d): a reconnect that hangs falls through to the choices
  if (!mounted || ((isReconnecting || isConnecting) && !slow))
    return <div className="sheet h-64 animate-pulse motion-reduce:animate-none" aria-busy="true" />
  if (needsWallet && !isConnected) {
    const noWallet = !e2eMode && !hasBrowserWallet()
    return (
      <div className="sheet grid justify-items-center gap-4 px-6 py-12 text-center">
        <p className="font-display text-4xl font-semibold">
          {noWallet ? 'This needs a wallet' : 'Connect your wallet'}
        </p>
        <p className="max-w-md text-ink-2">
          {noWallet
            ? 'Giving a budget and collecting payments use a crypto wallet: it holds the test USDC you give from, and you approve each step in it. This browser doesn’t have one.'
            : 'Your budgets, requests and payments are read from the blockchain for your wallet’s address. Nothing is stored by us.'}
        </p>
        {noWallet ? (
          <div className="grid w-full max-w-md gap-3 text-left">
            <div className="rounded-md border border-line p-4">
              <p className="font-medium">On a phone</p>
              <p className="text-sm text-ink-2">Open this page inside your wallet app’s browser:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {walletAppLinks(window.location.href).map((l) => (
                  <a key={l.name} href={l.href} className={buttonClass('secondary')}>
                    Open in {l.name}
                  </a>
                ))}
              </div>
            </div>
            <div className="rounded-md border border-line p-4">
              <p className="font-medium">On a computer</p>
              <p className="text-sm text-ink-2">
                Add a browser wallet such as MetaMask, Rabby or Coinbase Wallet, then reload this page.
              </p>
            </div>
          </div>
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
        {error && (
          <p role="alert" className="text-sm text-seal">
            {/no provider|not found/i.test(error.message)
              ? 'No browser wallet found. Install MetaMask, Rabby or Coinbase Wallet, then try again.'
              : error.message.split('\n')[0]}
          </p>
        )}
        <div className="mt-2 grid max-w-md gap-1 border-t border-line pt-4 text-sm text-ink-2">
          <p>
            Someone gave you a budget? You don’t need a crypto wallet:{' '}
            <Link href="/wallet" className="text-indigo underline">
              open it here
            </Link>
            .
          </p>
          <p>
            Want your AI assistant to pay?{' '}
            <Link href="/app/connect" className="text-indigo underline">
              Connect it with just your address
            </Link>
            .
          </p>
        </div>
      </div>
    )
  }
  return (
    <>
      {isConnected && walletChainId !== chain.chain.id && (
        <div
          role="alert"
          className="sheet mb-6 flex flex-wrap items-center justify-between gap-3 border-l-4 border-amber p-4"
        >
          <p>
            Your wallet is on another network. This account shows <strong>{chain.chain.name}</strong>.
          </p>
          <button
            type="button"
            className={buttonClass('primary')}
            disabled={switching}
            onClick={() => switchChain({ chainId: chain.chain.id })}
          >
            {switching ? 'Switching…' : `Switch to ${chain.chain.name}`}
          </button>
        </div>
      )}
      {children}
      {isConnected && <WalletFooter address={address!} />}
    </>
  )
}

function WalletFooter({ address }: { address: string }) {
  const { disconnect } = useDisconnect()
  return (
    <p className="mt-10 border-t border-line pt-4 text-sm text-ink-2">
      Connected as <span className="font-mono text-ink">{short(address)}</span> ·{' '}
      <button type="button" onClick={() => disconnect()} className="text-indigo underline">
        Disconnect
      </button>
    </p>
  )
}

function NavIcon({ name }: { name: (typeof NAV)[number]['icon'] }) {
  const p = {
    home: 'M4 11 12 4l8 7M6 10v10h12V10',
    budget: 'M4 7h16v12H4zM4 11h16M8 15h4',
    inbox: 'M4 13h5l1 3h4l1-3h5M5 5h14l1 8v6H4v-6z',
    collect: 'M12 4v11m0 0-4-4m4 4 4-4M5 20h14',
    people:
      'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3 20c.8-3.5 3-5 6-5s5.2 1.5 6 5M17 11a2.5 2.5 0 1 0 0-5M18 15c1.8.6 2.8 2.2 3 5',
    place: 'M12 21s7-6 7-11a7 7 0 1 0-14 0c0 5 7 11 7 11Zm0-9a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  }[name]
  return (
    <svg
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d={p} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
