'use client'
import { useCallback, useRef, useState } from 'react'
import type { Hex, PublicClient, TransactionReceipt } from 'viem'
import { short } from '@/lib/fmt'
import { txErrorMessage } from '@/lib/tx-errors'

/** §12.4 lifecycle: preparing → awaiting wallet → submitted → confirming → confirmed | failed. */
export type TxPhase = 'idle' | 'preparing' | 'awaiting-wallet' | 'submitted' | 'confirming' | 'confirmed' | 'failed'

export interface TxState {
  phase: TxPhase
  hash?: Hex
  error?: string
  receipt?: TransactionReceipt
}

const LABEL: Record<TxPhase, string> = {
  idle: '',
  preparing: 'Preparing…',
  'awaiting-wallet': 'Confirm in your wallet…',
  submitted: 'Submitted',
  confirming: 'Confirming on-chain…',
  confirmed: 'Confirmed',
  failed: 'Failed',
}

export function useTx(publicClient: PublicClient | undefined) {
  const observer = useRef<((hash: Hex) => Promise<void>) | undefined>(undefined)
  const [state, setState] = useState<TxState>({ phase: 'idle' })

  /** Once a hash is known, "retry" means checking its status, never sending again (§12.4). */
  const watch = useCallback(
    async (hash: Hex): Promise<TransactionReceipt | null> => {
      if (!publicClient) return null
      setState({ phase: 'confirming', hash })
      let replacementWrite: Promise<void> | undefined
      let replacementError: unknown
      try {
        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          timeout: 120_000,
          onReplaced: ({ transaction }) => {
            hash = transaction.hash
            replacementWrite = observer.current?.(hash).catch((error) => {
              replacementError = error
            })
          },
        })
        await replacementWrite
        if (replacementError) throw replacementError
        if (receipt.status !== 'success') {
          setState({ phase: 'failed', hash, receipt, error: 'The transaction reverted.' })
          return null
        }
        setState({ phase: 'confirmed', hash, receipt })
        return receipt
      } catch (e) {
        setState({ phase: 'failed', hash, error: `Still waiting for a receipt: ${friendly(e)}` })
        return null
      }
    },
    [publicClient],
  )

  /** `send` must return the tx hash once the wallet has broadcast it. Never reports success before the receipt. */
  const run = useCallback(
    async (
      send: () => Promise<Hex>,
      onSubmitted?: (hash: Hex) => Promise<void>,
    ): Promise<TransactionReceipt | null> => {
      observer.current = onSubmitted
      if (!publicClient) return null
      setState({ phase: 'preparing' })
      let hash: Hex | undefined
      try {
        setState({ phase: 'awaiting-wallet' })
        hash = await send()
        await onSubmitted?.(hash)
      } catch (e) {
        setState({ phase: 'failed', hash, error: friendly(e) })
        return null
      }
      setState({ phase: 'submitted', hash })
      return watch(hash)
    },
    [publicClient, watch],
  )

  const reset = useCallback(() => setState({ phase: 'idle' }), [])
  return { state, run, watch, reset }
}

// the wallet's own reason, never a guess (lib/tx-errors)
const friendly = (e: unknown) => txErrorMessage(e)

export function TxStatus({
  state,
  explorer,
  onCheck,
}: {
  state: TxState
  explorer: string
  onCheck?: (hash: Hex) => void
}) {
  if (state.phase === 'idle') return null
  const busy = ['preparing', 'awaiting-wallet', 'submitted', 'confirming'].includes(state.phase)
  return (
    <div role="status" aria-live="polite" className="mt-3 flex flex-wrap items-center gap-3 text-sm">
      <span
        className={state.phase === 'failed' ? 'font-medium text-seal' : busy ? 'text-ink-2' : 'font-medium text-ink'}
      >
        {busy && (
          <span
            aria-hidden
            className="mr-2 inline-block size-2 animate-pulse rounded-full bg-seal motion-reduce:animate-none"
          />
        )}
        {LABEL[state.phase]}
        {state.error && `: ${state.error}`}
      </span>
      {state.hash && (
        <a
          className="font-mono text-indigo underline"
          href={`${explorer}/tx/${state.hash}`}
          target="_blank"
          rel="noreferrer"
        >
          {short(state.hash)} ↗
        </a>
      )}
      {state.phase === 'failed' && state.hash && onCheck && (
        <button
          type="button"
          onClick={() => onCheck(state.hash!)}
          className="min-h-10 rounded border border-ink/30 px-3 hover:bg-paper-2"
        >
          Check status
        </button>
      )}
    </div>
  )
}
