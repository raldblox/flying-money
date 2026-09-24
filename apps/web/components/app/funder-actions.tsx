'use client'
import type { ChainConfig } from '@flying-money/chains'
import { type Certificate, flyingMoneyAbi } from '@flying-money/core'
import { useId, useState } from 'react'
import { erc20Abi, parseUnits } from 'viem'
import { useAccount, usePublicClient, useReadContract, useWalletClient } from 'wagmi'
import { buttonClass } from '@/components/section'
import { usdc, utcDate } from '@/lib/fmt'
import { TxStatus, useTx } from './tx'

const DAY = 86_400n
const MAX_LIFETIME = 365n * DAY
const EXTENSIONS = [
  { label: '+1 day', s: DAY },
  { label: '+7 days', s: 7n * DAY },
  { label: '+30 days', s: 30n * DAY },
]

type Panel = null | 'topup' | 'extend'

/**
 * §12.2 list actions for the funder: Top up, Extend (while open) and Reclaim (after expiry). The UI mirrors the
 * contract's rules (caps, lifetime ≤ 365 days, funder only) so a doomed transaction is never offered.
 */
export function FunderActions({ chain, cert, onDone }: { chain: ChainConfig; cert: Certificate; onDone: () => void }) {
  const now = BigInt(Math.floor(Date.now() / 1000))
  const expired = now > cert.expiresAt
  const [panel, setPanel] = useState<Panel>(null)
  const publicClient = usePublicClient({ chainId: chain.chain.id })
  const { data: wallet } = useWalletClient({ chainId: chain.chain.id })
  const { address } = useAccount()
  const tx = useTx(publicClient)
  const approveTx = useTx(publicClient)
  const ids = useId()
  const [amount, setAmount] = useState('1')

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: chain.usdc,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address && chain.flyingMoney ? [address, chain.flyingMoney] : undefined,
    chainId: chain.chain.id,
    query: { enabled: Boolean(address) && panel === 'topup' },
  })
  const { data: balance } = useReadContract({
    address: chain.usdc,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: chain.chain.id,
    query: { enabled: Boolean(address) && panel === 'topup' },
  })

  if (cert.closed) return <p className="mt-4 text-sm text-ink-2">Closed: the remainder was returned to you.</p>

  const busy = [tx.state, approveTx.state].some((s) =>
    ['preparing', 'awaiting-wallet', 'submitted', 'confirming'].includes(s.phase),
  )

  async function send(functionName: 'topUp' | 'extend' | 'reclaim', args: readonly unknown[]) {
    if (!wallet || !publicClient || !address || !chain.flyingMoney) return
    const r = await tx.run(async () => {
      const { request } = await publicClient.simulateContract({
        account: address,
        address: chain.flyingMoney!,
        abi: flyingMoneyAbi,
        functionName,
        args: args as never,
      })
      return wallet.writeContract(request)
    })
    if (r) {
      setPanel(null)
      onDone()
    }
  }

  // ── Reclaim ──
  if (expired) {
    const left = cert.faceValue - cert.redeemed
    return (
      <div className="mt-4">
        <p className="text-sm text-ink-2">
          Expired {utcDate(cert.expiresAt)}. {left > 0n ? `${usdc(left)} USDC was not spent.` : 'Everything was spent.'}
        </p>
        <button
          type="button"
          className={`${buttonClass('primary')} mt-3`}
          disabled={busy || !wallet}
          onClick={() => void send('reclaim', [cert.id])}
        >
          Reclaim {usdc(left)} USDC
        </button>
        <TxStatus state={tx.state} explorer={chain.explorer} onCheck={(h) => void tx.watch(h)} />
      </div>
    )
  }

  // ── Top up / Extend ──
  let add: bigint | null = null
  try {
    add = /^\d+(\.\d{1,6})?$/.test(amount.trim()) ? parseUnits(amount.trim(), 6) : null
  } catch {
    add = null
  }
  const problems: string[] = []
  if (panel === 'topup') {
    if (!add) problems.push('Enter an amount above 0 (up to 6 decimals).')
    if (add && chain.maxFaceValue > 0n && cert.faceValue + add > chain.maxFaceValue)
      problems.push(`This deployment caps a certificate at ${usdc(chain.maxFaceValue)} USDC.`)
    if (add && balance !== undefined && add > balance) problems.push(`Your wallet holds ${usdc(balance)} USDC.`)
  }
  const needsApproval = panel === 'topup' && add !== null && allowance !== undefined && allowance < add

  return (
    <div className="mt-4">
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Certificate actions</legend>
        {(
          [
            ['topup', 'Top up'],
            ['extend', 'Extend'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-expanded={panel === k}
            aria-controls={`${ids}-${k}`}
            onClick={() => {
              tx.reset()
              approveTx.reset()
              setPanel(panel === k ? null : k)
            }}
            className={`min-h-10 rounded border px-4 text-sm font-medium ${panel === k ? 'border-seal text-seal' : 'border-ink/30 hover:bg-paper-2'}`}
          >
            {label}
          </button>
        ))}
        <a
          href={`/c/${chain.key}/${cert.id}`}
          className="inline-flex min-h-10 items-center px-2 text-sm text-indigo underline"
        >
          Open page
        </a>
      </fieldset>

      {panel === 'topup' && (
        <form
          id={`${ids}-topup`}
          className="mt-3 grid gap-2 rounded border border-line p-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (problems.length || !add) return
            if (needsApproval)
              void approveTx
                .run(() =>
                  wallet!.writeContract({
                    address: chain.usdc,
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [chain.flyingMoney!, add!],
                  }),
                )
                .then((r) => r && refetchAllowance())
            else void send('topUp', [cert.id, add])
          }}
        >
          <label htmlFor={`${ids}-amt`} className="text-sm font-medium">
            Add to the budget (USDC)
          </label>
          <input
            id={`${ids}-amt`}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
            className="min-h-11 rounded border border-line bg-paper px-3 font-mono"
          />
          {problems.map((p) => (
            <p key={p} className="text-sm text-seal">
              {p}
            </p>
          ))}
          <button type="submit" className={buttonClass('primary')} disabled={busy || problems.length > 0 || !wallet}>
            {needsApproval ? `1 · Approve ${amount} USDC` : `Top up ${amount} USDC`}
          </button>
          <TxStatus state={approveTx.state} explorer={chain.explorer} />
          <TxStatus state={tx.state} explorer={chain.explorer} onCheck={(h) => void tx.watch(h)} />
        </form>
      )}

      {panel === 'extend' && (
        <div id={`${ids}-extend`} className="mt-3 grid gap-2 rounded border border-line p-4">
          <p className="text-sm">
            Now valid until <strong>{utcDate(cert.expiresAt)}</strong>. Extending keeps the money reserved for the same
            seller for longer. You can’t shorten it.
          </p>
          <div className="flex flex-wrap gap-2">
            {EXTENSIONS.map((x) => {
              const next = cert.expiresAt + x.s
              const tooFar = next > now + MAX_LIFETIME
              return (
                <button
                  key={x.label}
                  type="button"
                  disabled={busy || tooFar || !wallet}
                  title={tooFar ? 'A certificate can last at most 365 days from now.' : undefined}
                  onClick={() => void send('extend', [cert.id, next])}
                  className={buttonClass('secondary')}
                >
                  {x.label}
                </button>
              )
            })}
          </div>
          <TxStatus state={tx.state} explorer={chain.explorer} onCheck={(h) => void tx.watch(h)} />
        </div>
      )}
    </div>
  )
}
