import { allChains } from '@flying-money/chains'
import type { Metadata } from 'next'
import { AddressPill } from '@/components/address-pill'
import { StatusChip } from '@/components/status-chip'
import { usdc } from '@/lib/fmt'

export const metadata: Metadata = {
  title: 'Deployments',
  description: 'Every chain, contract address, USDC address and cap. Same source code and protocol on every chain.',
}

export default function ChainsPage() {
  const chains = allChains().filter((c) => c.key !== 'anvil')
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.2em] text-seal">Deployments</p>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight">Same source, every chain.</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-2">
        One contract source and protocol, deployed per chain with that chain’s Circle USDC and caps. Addresses differ
        per chain because the token and caps are constructor arguments; source verification on each explorer proves it
        is the same code. Pulled live from <code className="font-mono text-base">@flying-money/chains</code>.
      </p>

      <div className="mt-10 overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[760px] text-left text-sm">
          <caption className="sr-only">Flying Money deployments</caption>
          <thead className="bg-paper-2 text-ink-2">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Chain
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Status
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Contract
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                USDC
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Caps (per certificate · deployment)
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Gas
              </th>
            </tr>
          </thead>
          <tbody>
            {chains.map((c) => (
              <tr key={c.key} className="border-t border-line align-middle">
                <th scope="row" className="px-4 py-3 font-medium">
                  {c.chain.name}
                  <span className="block font-mono text-xs font-normal text-ink-2">
                    {c.key} · {c.chain.id}
                  </span>
                </th>
                <td className="px-4 py-3">
                  <StatusChip kind={c.flyingMoney ? 'open' : 'expired'}>
                    {c.mainnet ? 'Mainnet' : 'Testnet'} · {c.flyingMoney ? 'deployed' : 'not yet deployed'}
                  </StatusChip>
                </td>
                <td className="px-4 py-3">
                  {c.flyingMoney ? (
                    <AddressPill
                      value={c.flyingMoney}
                      href={`${c.explorer}/address/${c.flyingMoney}`}
                      label="contract address"
                    />
                  ) : (
                    <span className="text-ink-2">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <AddressPill value={c.usdc} href={`${c.explorer}/address/${c.usdc}`} label="USDC address" />
                </td>
                <td className="px-4 py-3 font-mono tabular-nums">
                  {c.maxFaceValue === 0n
                    ? 'unlimited'
                    : `${usdc(c.maxFaceValue, { min: 0 })} · ${usdc(c.maxTotalOutstanding, { min: 0 })} USDC`}
                </td>
                <td className="px-4 py-3">{c.gasToken}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-ink-2">
        Mainnet deployments carry immutable caps: per-certificate cap 100 USDC · deployment-wide cap 1,000 USDC.
        Unaudited. On Arc, USDC is also the gas token; Flying Money uses only its ERC‑20 interface (6 decimals).
      </p>
    </div>
  )
}
