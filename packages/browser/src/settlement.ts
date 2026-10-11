import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import type { CertKey, Hex } from '@flying-money/core'
import { createPublicClient, http, type PublicClient } from 'viem'
import { requestBackgroundRecovery, runtimeRegistry } from './background-registry.js'
import type { AtomicKV } from './idb.js'

export type SettlementState =
  | 'awaiting-wallet'
  | 'submitted'
  | 'confirming'
  | 'confirmed'
  | 'reverted'
  | 'cancelled'
  | 'needs-attention'
export interface SettlementJob {
  v: 1
  id: string
  chain: ChainKey
  payee: Hex
  keys: CertKey[]
  createdAt: number
  updatedAt: number
  state: SettlementState
  hash?: Hex
  previousHashes: Hex[]
  blockHash?: Hex
  blockNumber?: string
  confirmations: number
  requiredConfirmations: number
  detail?: string
}
export const settlementPending = (job: SettlementJob) => !['confirmed', 'reverted', 'cancelled'].includes(job.state)
const PREFIX = 'settlement:'
const notify = () => {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('fm-settlement-change'))
}
const validHash = (hash: string) => /^0x[0-9a-fA-F]{64}$/.test(hash)

/** Durable observation journal. There is intentionally no send/sign callback or automatic rebroadcast. */
export function settlementJournal(db: AtomicKV = runtimeRegistry()) {
  const list = async (): Promise<SettlementJob[]> => {
    const records = await Promise.all((await db.keys(PREFIX)).map((key) => db.get(key)))
    return records.filter((r): r is string => Boolean(r)).map((r) => JSON.parse(r) as SettlementJob)
  }
  const change = async (id: string, update: (job: SettlementJob) => void) => {
    await db.atomic((records) => {
      const raw = records.get(`${PREFIX}${id}`)
      if (!raw) throw new Error('Collection record not found.')
      const job = JSON.parse(raw) as SettlementJob
      update(job)
      job.updatedAt = Date.now()
      records.set(`${PREFIX}${id}`, JSON.stringify(job))
    })
  }
  return {
    list,
    async prepare(input: Pick<SettlementJob, 'chain' | 'payee' | 'keys'> & { requiredConfirmations?: number }) {
      getChain(input.chain)
      const job: SettlementJob = {
        ...input,
        v: 1,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        state: 'awaiting-wallet',
        previousHashes: [],
        confirmations: 0,
        requiredConfirmations: Math.max(1, input.requiredConfirmations ?? 2),
      }
      await db.atomic((records) => {
        for (const [key, raw] of records) {
          if (!key.startsWith(PREFIX)) continue
          const previous = JSON.parse(raw) as SettlementJob
          if (
            previous.chain === input.chain &&
            settlementPending(previous) &&
            previous.keys.some((k) => input.keys.includes(k))
          )
            throw new Error(
              'A collection for these payments is already being checked. Resolve it before sending another.',
            )
        }
        records.set(`${PREFIX}${job.id}`, JSON.stringify(job))
      })
      void requestBackgroundRecovery()
      notify()
      return job
    },
    async submitted(id: string, hash: Hex) {
      if (!validHash(hash)) throw new Error('Invalid transaction hash.')
      await change(id, (job) => {
        if (job.hash && job.hash !== hash) job.previousHashes.push(job.hash)
        job.hash = hash
        job.state = 'submitted'
        job.confirmations = 0
        delete job.blockHash
        delete job.blockNumber
        delete job.detail
      })
      void requestBackgroundRecovery()
      notify()
    },
    attention(id: string, detail: string) {
      return change(id, (job) => {
        job.state = 'needs-attention'
        job.detail = detail
      })
    },
    /** Only a definite wallet rejection or the user's explicit resolution may dismiss an unsent intent. */
    cancel(id: string) {
      return change(id, (job) => {
        if (job.hash) throw new Error('A submitted transaction must be checked, not dismissed.')
        job.state = 'cancelled'
      })
    },
    observe(
      id: string,
      receipt: { hash: Hex; blockHash: Hex; blockNumber: string; head: string; status: 'success' | 'reverted' } | null,
    ) {
      return change(id, (job) => {
        if (!receipt) {
          if (job.blockHash) {
            job.state = 'needs-attention'
            job.detail =
              'The previously observed receipt is no longer available. Collection is being rechecked; do not send again.'
          }
          return
        }
        if (receipt.hash.toLowerCase() !== job.hash?.toLowerCase())
          throw new Error('Receipt is for a different transaction.')
        job.blockHash = receipt.blockHash
        job.blockNumber = receipt.blockNumber
        job.confirmations = Number(
          BigInt(receipt.head) >= BigInt(receipt.blockNumber)
            ? BigInt(receipt.head) - BigInt(receipt.blockNumber) + 1n
            : 0n,
        )
        job.state =
          job.confirmations < job.requiredConfirmations
            ? 'confirming'
            : receipt.status === 'reverted'
              ? 'reverted'
              : 'confirmed'
        delete job.detail
      })
    },
  }
}

/** Re-reads canonical receipts, including saved confirmations, to detect disappearance/reorgs on later opens. */
export async function recoverSettlements(
  options: { journal?: ReturnType<typeof settlementJournal>; client?: (chain: ChainKey) => PublicClient } = {},
): Promise<boolean> {
  const journal = options.journal ?? settlementJournal()
  let waiting = false
  for (const job of await journal.list()) {
    if (job.state === 'cancelled' || job.state === 'reverted') continue
    if (!job.hash) {
      if (Date.now() - job.createdAt > 300_000 && job.state !== 'needs-attention')
        await journal.attention(
          job.id,
          'No transaction hash was saved. Check your wallet activity before resolving this collection.',
        )
      continue
    }
    try {
      const network = getChain(job.chain)
      const client =
        options.client?.(job.chain) ??
        (createPublicClient({
          chain: network.chain,
          transport: http(rpcUrl(job.chain), { timeout: 8_000, retryCount: 0 }),
        }) as PublicClient)
      const receipt = await client.getTransactionReceipt({ hash: job.hash })
      const [block, head] = await Promise.all([
        client.getBlock({ blockNumber: receipt.blockNumber }),
        client.getBlockNumber({ cacheTime: 0 }),
      ])
      if (block.hash !== receipt.blockHash) {
        await journal.observe(job.id, null)
        waiting = true
        continue
      }
      await journal.observe(job.id, {
        hash: job.hash,
        blockHash: receipt.blockHash,
        blockNumber: String(receipt.blockNumber),
        head: String(head),
        status: receipt.status,
      })
      if (head - receipt.blockNumber + 1n < BigInt(job.requiredConfirmations)) waiting = true
    } catch (error) {
      // Absence and RPC failure must never be interpreted as permission to resend.
      if ((error as { name?: string }).name === 'TransactionReceiptNotFoundError') await journal.observe(job.id, null)
      waiting = true
    }
  }
  return waiting
}
