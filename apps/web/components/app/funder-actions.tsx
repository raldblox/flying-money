'use client'
import type { ChainConfig } from '@flying-money/chains'
import { type Certificate, flyingMoneyAbi } from '@flying-money/core'
import { useId, useState } from 'react'
import { erc20Abi, parseEventLogs } from 'viem'
import { useAccount, usePublicClient, useReadContract, useWalletClient } from 'wagmi'
import { buttonClass } from '@/components/section'
import { dayTimeLabel, parseAmount, usdc } from '@/lib/fmt'
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
 * §12.2 list actions for the funder: Top up, Extend (while open) and Take back leftovers (after expiry, `reclaim`). The UI mirrors the
 * contract's rules (caps, lifetime ≤ 365 days, funder only) so a doomed transaction is never offered.
 */
export function FunderActions({
  chain,
  cert,
  onDone,
  initial,
  onConfirmed,
}: {
  chain: ChainConfig
  cert: Certificate
  onDone: () => void
  /** open a panel straight away, e.g. a top-up request's amount (§22.5 g) */
  initial?: { panel: 'topup'; amount: string }
  /** the confirmed transaction, e.g. to record an inbox decision */
  onConfirmed?: (action: 'topUp' | 'extend' | 'reclaim', txHash: `0x${string}`) => void
}) {
  const now = BigInt(Math.floor(Date.now() / 1000))
  const expired = now > cert.expiresAt
  const [panel, setPanel] = useState<Panel>(initial?.panel ?? null)
  const publicClient = usePublicClient({ chainId: chain.chain.id })
  const { data: wallet } = useWalletClient({ chainId: chain.chain.id })
  const { address } = useAccount()
  const tx = useTx(publicClient)
  const approveTx = useTx(publicClient)
  const ids = useId()
  const [amount, setAmount] = useState(initial?.amount ?? '1')

  // right after an approve, trust the receipt's Approval event over a possibly lagging RPC read
  const [approvedNow, setApprovedNow] = useState<bigint | null>(null)
  const [done, setDone] = useState<string | null>(null)
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

  // a confirmed action says so and stays said, even after the list refreshes (§22.5 c)
  const doneLine = done && (
    <p role="status" className="mt-4 flex items-center gap-2 text-sm font-medium text-ink">
      <span aria-hidden className="grid size-5 place-items-center rounded-full bg-seal-button text-xs text-on-seal">
        ✓
      </span>
      {done}
    </p>
  )
  if (cert.closed)
    return doneLine || <p className="mt-4 text-sm text-ink-2">Closed: what was left has been taken back.</p>

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
      return wallet.writeContract({ ...request, chain: chain.chain })
    })
    if (r) {
      onConfirmed?.(functionName, r.transactionHash)
      setApprovedNow(null)
      void refetchAllowance()
      setDone(
        functionName === 'topUp'
          ? `Added ${usdc(args[1] as bigint)} USDC. The budget is now ${usdc(cert.faceValue + (args[1] as bigint))} USDC.`
          : functionName === 'extend'
            ? `Extended. It now ends ${dayTimeLabel(args[1] as bigint)}.`
            : `Took back ${usdc(cert.faceValue - cert.redeemed)} USDC.`,
      )
      setPanel(null)
      onDone()
    }
  }

  // ── Reclaim ──
  if (expired) {
    const left = cert.faceValue - cert.redeemed
    return (
      <div className="mt-4">
        {doneLine}
        <p className="text-sm text-ink-2">
          Ended <span suppressHydrationWarning>{dayTimeLabel(cert.expiresAt)}</span>.{' '}
          {left > 0n
            ? `${usdc(left)} USDC was not spent. Take it back with one network transaction.`
            : 'Everything was spent.'}
        </p>
        <button
          type="button"
          className={`${buttonClass('primary')} mt-3`}
          disabled={busy || !wallet}
          onClick={() => void send('reclaim', [cert.id])}
        >
          Take back {usdc(left)} USDC
        </button>
        <TxStatus state={tx.state} explorer={chain.explorer} onCheck={(h) => void tx.watch(h)} />
      </div>
    )
  }

  // ── Top up / Extend ──
  // a decimal comma works too; never a float (§22.5 h)
  const add = parseAmount(amount)
  const problems: string[] = []
  if (panel === 'topup') {
    if (!add) problems.push('Enter an amount above 0 (up to 6 decimals).')
    if (add && chain.maxFaceValue > 0n && cert.faceValue + add > chain.maxFaceValue)
      problems.push(`This deployment caps a budget at ${usdc(chain.maxFaceValue)} USDC.`)
    if (add && balance !== undefined && add > balance) problems.push(`Your wallet holds ${usdc(balance)} USDC.`)
  }
  const effectiveAllowance =
    allowance === undefined ? undefined : approvedNow !== null && approvedNow > allowance ? approvedNow : allowance
  const needsApproval =
    panel === 'topup' && add !== null && effectiveAllowance !== undefined && effectiveAllowance < add

  return (
    <div className="mt-4">
      {doneLine}
      <fieldset className="flex flex-wrap gap-2">
        <legend className="sr-only">Budget actions</legend>
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
                    chain: chain.chain,
                    address: chain.usdc,
                    abi: erc20Abi,
                    functionName: 'approve',
                    args: [chain.flyingMoney!, add!],
                  }),
                )
                .then((r) => {
                  if (!r) return
                  const [ev] = parseEventLogs({ abi: erc20Abi, logs: r.logs, eventName: 'Approval' })
                  if (ev) setApprovedNow(ev.args.value)
                  void refetchAllowance()
                })
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
            onChange={(e) => setAmount(e.target.value)}
            className="min-h-11 rounded border border-line bg-paper px-3 font-mono"
          />
          {problems.map((p) => (
            <p key={p} className="text-sm text-seal">
              {p}
            </p>
          ))}
          {add !== null && add > 0n && (
            <ol className="grid gap-1 text-sm">
              <li className={needsApproval ? 'font-medium text-ink' : 'text-ink-2 line-through decoration-ink/30'}>
                Step 1 of 2: let the contract move exactly {usdc(add)} USDC from your wallet. Nothing is sent yet.
              </li>
              <li className={needsApproval ? 'text-ink-2' : 'font-medium text-ink'}>
                Step 2 of 2: add {usdc(add)} USDC to this budget. It still pays only the same seller.
              </li>
            </ol>
          )}
          <button type="submit" className={buttonClass('primary')} disabled={busy || problems.length > 0 || !wallet}>
            {needsApproval
              ? `Step 1 of 2: Approve ${add ? usdc(add) : amount} USDC`
              : `Step 2 of 2: Add ${add ? usdc(add) : amount} USDC`}
          </button>
          <TxStatus state={approveTx.state} explorer={chain.explorer} />
          <TxStatus state={tx.state} explorer={chain.explorer} onCheck={(h) => void tx.watch(h)} />
        </form>
      )}

      {panel === 'extend' && (
        <div id={`${ids}-extend`} className="mt-3 grid gap-2 rounded border border-line p-4">
          <p className="text-sm">
            Now ends <strong suppressHydrationWarning>{dayTimeLabel(cert.expiresAt)}</strong>. Extending keeps the money
            reserved for the same seller for longer. You can’t shorten it.
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
                  aria-describedby={tooFar ? `${ids}-toofar` : undefined}
                  onClick={() => void send('extend', [cert.id, next])}
                  className={buttonClass('secondary')}
                >
                  {x.label}
                </button>
              )
            })}
          </div>
          {EXTENSIONS.some((x) => cert.expiresAt + x.s > now + MAX_LIFETIME) && (
            <p id={`${ids}-toofar`} className="text-xs text-ink-2">
              A budget can last at most 365 days from now, so longer options are off.
            </p>
          )}
          <TxStatus state={tx.state} explorer={chain.explorer} onCheck={(h) => void tx.watch(h)} />
        </div>
      )}
    </div>
  )
}
