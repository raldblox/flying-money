'use client'
import { flyingMoneyAbi } from '@flying-money/abi'
import { createRecovery } from '@flying-money/browser'
import {
  recoverSettlements,
  type SettlementJob,
  settlementJournal,
  settlementPending,
} from '@flying-money/browser/settlement'
import { type ChainKey, getChain } from '@flying-money/chains'
import { useCallback, useEffect, useState } from 'react'
import { decodeFunctionData, type Hex } from 'viem'
import { publicClient } from '@/lib/chain'

/** Recovery only observes saved transactions. Any additional collection still requires a user action. */
export function SettlementRecovery({
  chain,
  payee,
  sponsored = false,
}: {
  chain: ChainKey
  payee: Hex
  sponsored?: boolean
}) {
  const [jobs, setJobs] = useState<SettlementJob[]>([])
  const [error, setError] = useState('')
  const [hashes, setHashes] = useState<Record<string, string>>({})
  const refresh = useCallback(async () => {
    const journal = settlementJournal()
    if (sponsored)
      for (const job of await journal.list()) {
        if (
          job.chain !== chain ||
          job.payee.toLowerCase() !== payee.toLowerCase() ||
          job.hash ||
          !settlementPending(job)
        )
          continue
        const response = await fetch(`/api/demo/counter/collect?id=${job.id}`)
        if (response.ok) {
          const record = await response.json()
          if (record.hash) await journal.submitted(job.id, record.hash)
        }
      }
    const waiting = await recoverSettlements({ journal, client: publicClient })
    setJobs(
      (await journal.list()).filter(
        (job) => job.chain === chain && job.payee.toLowerCase() === payee.toLowerCase() && settlementPending(job),
      ),
    )
    return (
      waiting ||
      (await journal.list()).some(
        (job) => job.chain === chain && job.payee.toLowerCase() === payee.toLowerCase() && settlementPending(job),
      )
    )
  }, [chain, payee, sponsored])
  useEffect(() => {
    const recovery = createRecovery({ reconcile: refresh })
    const wake = () => {
      void recovery.wake()
    }
    const visible = () => {
      if (document.visibilityState === 'visible') wake()
    }
    window.addEventListener('fm-settlement-change', wake)
    window.addEventListener('online', wake)
    window.addEventListener('focus', wake)
    document.addEventListener('visibilitychange', visible)
    wake()
    return () => {
      window.removeEventListener('fm-settlement-change', wake)
      window.removeEventListener('online', wake)
      window.removeEventListener('focus', wake)
      document.removeEventListener('visibilitychange', visible)
      void recovery.stop()
    }
  }, [refresh])
  async function attach(job: SettlementJob) {
    try {
      const hash = hashes[job.id]?.trim() as Hex
      if (!/^0x[0-9a-fA-F]{64}$/.test(hash ?? '')) throw new Error('Paste the full transaction hash from your wallet.')
      const transaction = await publicClient(chain).getTransaction({ hash })
      if (transaction.to?.toLowerCase() !== getChain(chain).flyingMoney?.toLowerCase())
        throw new Error('That transaction is not a Flying Money collection.')
      const call = decodeFunctionData({ abi: flyingMoneyAbi, data: transaction.input })
      if (
        call.functionName !== 'redeemMany' ||
        !job.keys.every((key) => call.args[0].some((note) => key.endsWith(`:${note.certificateId.toLowerCase()}`)))
      )
        throw new Error('That collection does not include these budgets.')
      await settlementJournal().submitted(job.id, hash)
      await refresh()
      setError('')
    } catch (e) {
      setError((e as Error).message)
    }
  }
  if (!jobs.length && !error) return null
  return (
    <section className="sheet grid gap-3 p-6" aria-label="Saved collections">
      <h2 className="font-display text-xl font-semibold">Saved collections</h2>
      <p className="text-sm text-ink-2">
        Checking resumes when you reopen this till. These checks never send another transaction.
      </p>
      {jobs.map((job) => (
        <div key={job.id} className="grid gap-2 border-t border-line pt-3">
          <p role="status" className="text-sm">
            {job.detail ??
              (job.hash
                ? `Waiting for network confirmation (${job.confirmations}/${job.requiredConfirmations}).`
                : sponsored
                  ? 'We handle collection for this demo, so there is nothing for you to do. It is being checked, and no extra transaction will be sent.'
                  : 'No transaction hash was saved. Check your wallet activity before continuing.')}
          </p>
          {job.hash ? (
            <a
              className="text-sm text-indigo underline"
              href={`${getChain(chain).explorer}/tx/${job.hash}`}
              target="_blank"
              rel="noreferrer"
            >
              View transaction
            </a>
          ) : sponsored ? (
            <p className="text-sm text-ink-2">You can leave and come back: the status will be here.</p>
          ) : (
            <>
              <label className="grid gap-1 text-sm">
                Transaction hash from your wallet
                <input
                  className="min-h-11 rounded border border-line bg-paper px-3"
                  value={hashes[job.id] ?? ''}
                  onChange={(e) => setHashes({ ...hashes, [job.id]: e.target.value })}
                />
              </label>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  className="min-h-11 text-sm text-indigo underline"
                  onClick={() => void attach(job)}
                >
                  Resume this transaction
                </button>
                <button
                  type="button"
                  className="min-h-11 text-sm underline"
                  onClick={async () => {
                    try {
                      await settlementJournal().cancel(job.id)
                      await refresh()
                    } catch (e) {
                      setError((e as Error).message)
                    }
                  }}
                >
                  I checked my wallet: nothing was sent
                </button>
              </div>
            </>
          )}
        </div>
      ))}
      {error && (
        <p role="alert" className="text-sm text-seal">
          {error}
        </p>
      )}
      <button
        type="button"
        className="min-h-11 w-fit text-sm text-indigo underline"
        onClick={() => void refresh().catch((e) => setError(e.message))}
      >
        Check saved collections
      </button>
    </section>
  )
}
