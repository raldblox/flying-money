'use client'
import { type ChainKey, getChain, getChainById, isChainKey } from '@flying-money/chains'
import type { Certificate, Hex } from '@flying-money/core'
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { erc20Abi } from 'viem'
import { AddressPill } from '@/components/address-pill'
import { loadCertificates } from '@/components/app/certificate-lists'
import { buttonClass, Sheet } from '@/components/section'
import { StatusChip } from '@/components/status-chip'
import { publicClient } from '@/lib/chain'
import { relTime, short, usdc } from '@/lib/fmt'

interface Entry {
  at: number
  kind: 'paid' | 'failed' | 'collected'
  host?: string
  network?: string
  amount: string
  price?: string
  tx?: string
}
interface Status {
  name: string
  wallet: Hex
  budgetChains: string[]
  limits: { maxPerCall: string; feeBps: number; quotesPerMinute: number }
  balances: Array<{ network: string; usdc: string | null; gas: string | null }>
  liquidity: { health: 'ok' | 'low' | 'empty'; coversCalls: string; basedOnPrice: string; note: string }
  owedByContract: string
  totals: {
    paid: number
    failed: number
    spentOnSites: string
    chargedToAgents: string
    collected: string
    since: number
  }
  recent: Entry[]
}

const HEALTH = {
  ok: { kind: 'open', label: 'Funded' },
  low: { kind: 'unverified', label: 'Low: top up soon' },
  empty: { kind: 'expired', label: 'Empty: it can’t pay sites' },
} as const

const eth = (wei: bigint) => (Number(wei) / 1e18).toFixed(6)

/** The chain behind a CAIP-2 network id ("eip155:8453"). */
const chainOf = (network?: string) => {
  const id = network ? /^eip155:(\d+)$/.exec(network)?.[1] : undefined
  return id ? getChainById(Number(id)) : undefined
}

function useStatus(url: string) {
  return useQuery({
    queryKey: ['bridge-status', url],
    enabled: Boolean(url),
    refetchInterval: 15_000,
    queryFn: async (): Promise<Status> => {
      const res = await fetch(`${url.replace(/\/$/, '')}/status`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`The bridge answered ${res.status}`)
      return (await res.json()) as Status
    },
  })
}

/** What the chain itself says about the bridge's wallet and the budgets made out to it: no trust in the bridge needed. */
function useOnChain(status: Status | undefined) {
  return useQuery({
    queryKey: ['bridge-chain', status?.wallet, status?.budgetChains.join(',')],
    enabled: Boolean(status),
    refetchInterval: 30_000,
    queryFn: async () => {
      const s = status as Status
      const out: Array<{
        key: ChainKey
        usdc: bigint
        gas: bigint
        certs: Certificate[]
      }> = []
      for (const k of s.budgetChains) {
        if (!isChainKey(k)) continue
        const chain = getChain(k)
        if (!chain.flyingMoney) continue
        const client = publicClient(k)
        const [usdcBal, gasBal, certs] = await Promise.all([
          client.readContract({ address: chain.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [s.wallet] }),
          client.getBalance({ address: s.wallet }),
          loadCertificates(client, chain, 'payee', s.wallet),
        ])
        out.push({ key: k, usdc: usdcBal, gas: gasBal, certs })
      }
      return out
    },
  })
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <dt className="smallcaps text-xs text-ink-2">{label}</dt>
      <dd className="font-display text-2xl tabular-nums">{children}</dd>
    </div>
  )
}

export function BridgeMonitor() {
  const [url, setUrl] = useState('')
  const [typed, setTyped] = useState('')
  useEffect(() => {
    const u = new URLSearchParams(window.location.search).get('url') ?? ''
    setUrl(u)
    setTyped(u)
  }, [])
  const q = useStatus(url)
  const chainQ = useOnChain(q.data)
  const s = q.data

  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <p className="smallcaps text-sm text-seal">Bridge</p>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight">Check a bridge.</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-2">
        A bridge lets an agent pay ordinary x402 sites from its budget. It pays each site from its own wallet first,
        then collects the budget from the contract. Enter a bridge’s address to see its balance, what it owes and is
        owed, and what it paid, and check the numbers against the chain yourself.
      </p>

      <form
        className="mt-8 flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          setUrl(typed.trim())
          try {
            window.history.replaceState(null, '', `?url=${encodeURIComponent(typed.trim())}`)
          } catch {}
        }}
      >
        <label className="grid gap-1 text-sm font-medium">
          Bridge address
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder="https://my-bridge.example"
            inputMode="url"
            autoComplete="off"
            className="min-h-11 w-[min(32rem,90vw)] rounded-[3px] border border-ink/25 bg-paper px-3 font-mono text-sm focus-visible:outline-2 focus-visible:outline-indigo"
          />
        </label>
        <button type="submit" className={buttonClass('primary')}>
          Check
        </button>
      </form>

      {!url && (
        <p className="mt-6 text-ink-2">
          Running your own? See{' '}
          <a href="/docs/bridge" className="text-indigo underline">
            how to run a bridge
          </a>{' '}
          and how{' '}
          <a href="/docs/bridge#how-the-money-moves" className="text-indigo underline">
            the money moves
          </a>
          .
        </p>
      )}
      {url && q.isLoading && <p className="mt-6 text-ink-2">Reading the bridge…</p>}
      {url && q.isError && (
        <p role="alert" className="mt-6 text-seal">
          Couldn’t read {url}/status: {(q.error as Error).message}. Is the address right, and is the bridge running?
        </p>
      )}

      {s && (
        <div className="mt-8 grid gap-8">
          <Sheet className="p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-3xl font-semibold">{s.name}</h2>
                <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-ink-2">
                  Its wallet
                  <AddressPill value={s.wallet} label="bridge wallet" />
                  <span>· budgets on {s.budgetChains.join(', ')}</span>
                </p>
              </div>
              <StatusChip kind={HEALTH[s.liquidity.health].kind}>{HEALTH[s.liquidity.health].label}</StatusChip>
            </div>
            <dl className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <Fact label="Can still pay about">{s.liquidity.coversCalls} calls</Fact>
              <Fact label="Owed to it by the contract">{usdc(BigInt(s.owedByContract))} USDC</Fact>
              <Fact label="Paid to sites">{usdc(BigInt(s.totals.spentOnSites))} USDC</Fact>
              <Fact label="Collected from budgets">{usdc(BigInt(s.totals.collected))} USDC</Fact>
            </dl>
            <p className="mt-4 text-sm text-ink-2">
              {s.liquidity.note} It pays at most {usdc(BigInt(s.limits.maxPerCall))} USDC per call, adds a{' '}
              {s.limits.feeBps / 100}% fee, and has made {s.totals.paid} payment{s.totals.paid === 1 ? '' : 's'}
              {s.totals.failed > 0 ? ` (${s.totals.failed} failed and were not charged)` : ''}.
            </p>
          </Sheet>

          <section aria-labelledby="verify-t">
            <h2 id="verify-t" className="font-display text-3xl font-semibold">
              Check it against the chain
            </h2>
            <p className="mt-2 max-w-3xl text-ink-2">
              These numbers are read from the blockchain by your browser, not from the bridge. If they disagree with
              what the bridge reports, trust the chain.
            </p>
            {chainQ.isLoading && <p className="mt-3 text-ink-2">Reading the chain…</p>}
            {chainQ.isError && (
              <p role="alert" className="mt-3 text-seal">
                Couldn’t read the chain: {(chainQ.error as Error).message.split('\n')[0]}
              </p>
            )}
            {chainQ.data?.map((c) => {
              const chain = getChain(c.key)
              const reported = s.balances.find((b) => chainOf(b.network)?.key === c.key)
              const mismatch = reported?.usdc != null && BigInt(reported.usdc) !== c.usdc
              const onChainCollected = c.certs.reduce((t, x) => t + x.redeemed, 0n)
              const locked = c.certs.reduce((t, x) => t + (x.closed ? 0n : x.faceValue - x.redeemed), 0n)
              return (
                <Sheet key={c.key} className="mt-4 p-6">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="font-display text-2xl font-semibold">{chain.chain.name}</h3>
                    <StatusChip kind={chain.mainnet ? 'sealed' : 'open'}>
                      {chain.mainnet ? 'Mainnet · real USDC' : 'Testnet'}
                    </StatusChip>
                  </div>
                  <dl className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    <Fact label="Wallet balance (USDC)">{usdc(c.usdc)}</Fact>
                    <Fact label="Fee balance (ETH)">{chain.gasToken === 'ETH' ? eth(c.gas) : '—'}</Fact>
                    <Fact label="Collected, on-chain">{usdc(onChainCollected)} USDC</Fact>
                    <Fact label="Still locked for it">{usdc(locked)} USDC</Fact>
                  </dl>
                  {mismatch && (
                    <p role="alert" className="mt-3 text-sm text-seal">
                      The bridge reports {usdc(BigInt(reported?.usdc ?? '0'))} USDC in its wallet but the chain shows{' '}
                      {usdc(c.usdc)}. Trust the chain.
                    </p>
                  )}
                  <p className="mt-3 text-sm text-ink-2">
                    <a
                      className="text-indigo underline"
                      href={`${chain.explorer}/address/${s.wallet}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Wallet on the explorer ↗
                    </a>{' '}
                    ·{' '}
                    <a
                      className="text-indigo underline"
                      href={`${chain.explorer}/address/${chain.flyingMoney}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Contract ↗
                    </a>
                  </p>
                  <h4 className="mt-5 font-medium">Budgets made out to this bridge ({c.certs.length})</h4>
                  {c.certs.length === 0 ? (
                    <p className="mt-1 text-sm text-ink-2">None yet.</p>
                  ) : (
                    <ul className="mt-2 grid gap-2 text-sm">
                      {c.certs.map((x) => (
                        <li
                          key={x.id}
                          className="flex flex-wrap items-center justify-between gap-2 rounded border border-line p-3"
                        >
                          <a className="font-mono text-indigo underline" href={`/c/${c.key}/${x.id}`}>
                            {short(x.id)}
                          </a>
                          <span className="text-ink-2">
                            agent key {short(x.spender)} · funded by {short(x.funder)}
                          </span>
                          <span className="tabular-nums">
                            {usdc(x.redeemed)} collected of {usdc(x.faceValue)} USDC ·{' '}
                            {x.closed ? 'closed' : `ends ${relTime(x.expiresAt)}`}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Sheet>
              )
            })}
          </section>

          <section aria-labelledby="recent-t">
            <h2 id="recent-t" className="font-display text-3xl font-semibold">
              Recent activity
            </h2>
            <p className="mt-2 max-w-3xl text-ink-2">
              What the bridge paid and collected, newest first. Every payment links to its transaction so you can verify
              it. No agent identity or request content is shown here.
            </p>
            {s.recent.length === 0 ? (
              <p className="mt-3 text-ink-2">Nothing yet.</p>
            ) : (
              <div className="sheet mt-4 overflow-x-auto px-2 py-2">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <caption className="sr-only">Recent bridge activity</caption>
                  <thead>
                    <tr className="text-ink">
                      <th scope="col" className="px-3 py-2 font-medium">
                        When
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        What
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Amount (USDC)
                      </th>
                      <th scope="col" className="px-3 py-2 font-medium">
                        Transaction
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {s.recent.map((e, i) => {
                      const chain = chainOf(e.network)
                      return (
                        // biome-ignore lint/suspicious/noArrayIndexKey: an append-only log, ordered
                        <tr key={i} className="border-t border-line">
                          <td className="px-3 py-2 text-ink-2">{new Date(e.at).toLocaleString()}</td>
                          <td className="px-3 py-2">
                            {e.kind === 'paid' && `Paid ${e.host}`}
                            {e.kind === 'failed' && `Tried ${e.host} (not charged)`}
                            {e.kind === 'collected' && 'Collected from budgets'}
                          </td>
                          <td className="px-3 py-2 font-mono tabular-nums">{usdc(BigInt(e.amount))}</td>
                          <td className="px-3 py-2">
                            {e.tx && chain ? (
                              <a
                                className="font-mono text-indigo underline"
                                href={`${chain.explorer}/tx/${e.tx}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                {short(e.tx)} ↗
                              </a>
                            ) : (
                              '—'
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section aria-labelledby="trust-t" className="max-w-3xl">
            <h2 id="trust-t" className="font-display text-3xl font-semibold">
              What to trust
            </h2>
            <ul className="mt-3 grid gap-2 text-ink-2">
              <li>
                The contract pays out only against payments signed by the agent’s key, so the bridge can’t take more
                than the agent signed.
              </li>
              <li>
                The bridge decides the price it quotes. Agents set their own price limit; keep budgets small and short.
              </li>
              <li>
                The wallet balance, the budgets and the collected totals above come from the chain. The activity log and
                the “owed” figure come from the bridge itself.
              </li>
            </ul>
          </section>
        </div>
      )}
    </div>
  )
}
