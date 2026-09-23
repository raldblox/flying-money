import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import { type Certificate, certKey, flyingMoneyAbi, type Hex, readCertificate } from '@flying-money/core'
import {
  createPublicClient,
  createWalletClient,
  encodeFunctionData,
  http,
  keccak256,
  type LocalAccount,
  type PublicClient,
  parseEventLogs,
  type TransactionReceipt,
} from 'viem'
import type { CertKey, NoteStore, PendingRedemption, Submission } from './store.js'

export interface RedeemPolicy {
  /** Redeem a certificate once its served-but-unredeemed value reaches this (base units). */
  minAmount: bigint
  /** …or once the oldest served-but-unredeemed value is this old (seconds). */
  maxAgeSeconds: number
  /** …or once expiry is this close (seconds). Default 1800 (§6.7). */
  safetyBeforeExpiry: number
}

export interface RedeemedEvent {
  chainId: number
  txHash: Hex
  certificateId: Hex
  cumulative: bigint
  paid: bigint
}
export interface SkippedEvent {
  chainId: number
  txHash: Hex
  certificateId: Hex
  cumulative: bigint
  reason: number
}

export interface RedeemerConfig {
  chains: ChainKey[]
  store: NoteStore
  /** Needs gas on each chain; funds always go to the payee regardless of who redeems. */
  redeemerAccount: LocalAccount
  policy: RedeemPolicy
  env?: Record<string, string | undefined>
  /** Unix seconds. */
  now?: () => number
  batchSize?: number
  /** Receipt polling interval (viem default 4 s; lower it for fast chains/anvil). */
  pollingIntervalMs?: number
  onRedeemed?: (e: RedeemedEvent) => void
  onSkipped?: (e: SkippedEvent) => void
  /** Operator alert: reverted batch (token-level failure), dropped tx, RPC errors. */
  onError?: (e: Error, chainId: number) => void
}

export interface Redeemer {
  /** One pass over every chain. `force` ignores the policy thresholds (demo "Redeem now"). */
  tick(opts?: { force?: boolean }): Promise<void>
  /** Background loop; returns stop(). */
  start(intervalMs?: number): () => void
}

/**
 * The redeemer (§8.3): redeems only served value (§6.5 redemption policy), batches up to 20 notes into
 * redeemMany, records the tx hash BEFORE broadcasting, and never rebroadcasts a known hash (ported idea).
 */
export function createRedeemer(config: RedeemerConfig): Redeemer {
  const batchSize = config.batchSize ?? 20
  const nowS = () => BigInt(Math.floor(config.now ? config.now() : Date.now() / 1000))
  const store = config.store
  const account = config.redeemerAccount

  const chains = config.chains.map((key) => {
    const c = getChain(key)
    if (!c.flyingMoney) throw new Error(`No FlyingMoney deployment for ${key}`)
    const transport = http(rpcUrl(key, config.env ?? {}))
    return {
      key,
      chainId: c.chain.id,
      contract: c.flyingMoney,
      confirmations: Math.max(1, c.confirmations),
      pub: createPublicClient({
        chain: c.chain,
        transport,
        ...(config.pollingIntervalMs ? { pollingInterval: config.pollingIntervalMs } : {}),
      }) as PublicClient,
      wallet: createWalletClient({ account, chain: c.chain, transport }),
    }
  })
  type Chain = (typeof chains)[number]

  const certs = new Map<CertKey, Certificate>()
  const readCert = async (ch: Chain, id: Hex, fresh = false) => {
    const k = certKey(ch.chainId, id)
    if (!fresh && certs.has(k)) return certs.get(k)!
    const c = await readCertificate(ch.pub, ch.contract, id)
    if (c) certs.set(k, c)
    return c
  }

  const idOf = (key: CertKey) => key.split(':')[1] as Hex

  /** Bring the store in line with the chain for these certificates (after a revert, drop or skip). */
  async function reconcile(ch: Chain, keys: CertKey[], txHash: Hex) {
    for (const key of keys) {
      const c = await readCert(ch, idOf(key), true)
      if (c) await store.markRedeemed(key, c.redeemed, txHash)
    }
  }

  async function settle(ch: Chain, sub: Submission, receipt: TransactionReceipt) {
    if (receipt.status === 'success') {
      const logs = parseEventLogs({
        abi: flyingMoneyAbi,
        logs: receipt.logs,
        eventName: ['NoteRedeemed', 'NoteSkipped'],
      })
      for (const log of logs) {
        if (log.address.toLowerCase() !== ch.contract.toLowerCase()) continue
        const key = certKey(ch.chainId, log.args.id)
        if (log.eventName === 'NoteRedeemed') {
          await store.markRedeemed(key, log.args.cumulative, sub.txHash)
          config.onRedeemed?.({
            chainId: ch.chainId,
            txHash: sub.txHash,
            certificateId: log.args.id,
            cumulative: log.args.cumulative,
            paid: log.args.paid,
          })
        } else {
          config.onSkipped?.({
            chainId: ch.chainId,
            txHash: sub.txHash,
            certificateId: log.args.id,
            cumulative: log.args.cumulative,
            reason: log.args.reason,
          })
          await reconcile(ch, [key], sub.txHash) // e.g. reason 5: someone already redeemed a higher note
        }
      }
    } else {
      await reconcile(ch, sub.keys, sub.txHash)
      config.onError?.(new Error(`redeemMany ${sub.txHash} reverted (token-level failure?)`), ch.chainId)
    }
    await store.setSubmission(ch.chainId, null)
  }

  /** Returns true if a submission is still in flight (and nothing new may be sent). */
  async function checkSubmission(ch: Chain): Promise<boolean> {
    const sub = await store.getSubmission(ch.chainId)
    if (!sub) return false
    const receipt = await ch.pub.getTransactionReceipt({ hash: sub.txHash }).catch(() => null)
    if (receipt) {
      const head = await ch.pub.getBlockNumber()
      if (head - receipt.blockNumber + 1n < BigInt(ch.confirmations)) return true
      await settle(ch, sub, receipt)
      return false
    }
    if (sub.nonce !== undefined) {
      const mined = await ch.pub.getTransactionCount({ address: account.address, blockTag: 'latest' })
      if (mined > sub.nonce) {
        // our nonce was used by another tx and ours has no receipt: dropped/replaced. Never rebroadcast.
        await reconcile(ch, sub.keys, sub.txHash)
        await store.setSubmission(ch.chainId, null)
        config.onError?.(new Error(`submission ${sub.txHash} was dropped/replaced; reconciled from chain`), ch.chainId)
        return false
      }
    }
    return true // still pending: wait, never rebroadcast
  }

  async function eligible(ch: Chain, items: PendingRedemption[], force: boolean) {
    const out: PendingRedemption[] = []
    const t = nowS()
    for (const it of items) {
      let c = await readCert(ch, it.note.certificateId)
      if (c && t > c.expiresAt) c = await readCert(ch, it.note.certificateId, true) // may have been extended
      if (!c || c.closed || t > c.expiresAt) continue // can no longer be redeemed
      if (c.redeemed >= it.note.cumulative) {
        await store.markRedeemed(it.key, c.redeemed, `0x${'0'.repeat(64)}`)
        continue
      }
      const amount = it.note.cumulative - it.redeemedOnChain
      const aged =
        it.oldestServedAt !== undefined && Date.now() - it.oldestServedAt >= config.policy.maxAgeSeconds * 1000
      const nearExpiry = c.expiresAt - t <= BigInt(config.policy.safetyBeforeExpiry)
      if (force || amount >= config.policy.minAmount || aged || nearExpiry) out.push(it)
    }
    return out
  }

  async function runChain(ch: Chain, force: boolean) {
    if (await checkSubmission(ch)) return
    const batch = (await eligible(ch, await store.pendingRedemptions(ch.chainId), force)).slice(0, batchSize)
    if (batch.length === 0) return

    const data = encodeFunctionData({
      abi: flyingMoneyAbi,
      functionName: 'redeemMany',
      args: [
        batch.map((b) => ({
          certificateId: b.note.certificateId,
          cumulative: b.note.cumulative,
          memo: b.note.memo,
          signature: b.note.sig,
        })),
      ],
    })
    const request = await ch.wallet.prepareTransactionRequest({
      account,
      to: ch.contract,
      data,
      chain: ch.wallet.chain,
    })
    const serialized = await account.signTransaction(request as never)
    const txHash = keccak256(serialized)
    const sub: Submission = { txHash, keys: batch.map((b) => b.key), nonce: request.nonce }
    await store.setSubmission(ch.chainId, sub) // record BEFORE broadcasting
    try {
      await ch.pub.sendRawTransaction({ serializedTransaction: serialized })
    } catch (e) {
      const known = await ch.pub.getTransaction({ hash: txHash }).catch(() => null)
      if (!known) {
        await store.setSubmission(ch.chainId, null) // never reached the network: safe to clear
        throw e
      }
    }
    const receipt = await ch.pub.waitForTransactionReceipt({ hash: txHash, confirmations: ch.confirmations })
    await settle(ch, sub, receipt)
  }

  // Ticks are serialised: two overlapping ticks must never both start a submission for one chain.
  let queue: Promise<void> = Promise.resolve()
  function tick(opts: { force?: boolean } = {}): Promise<void> {
    const run = queue.then(() => tickOnce(opts))
    queue = run.catch(() => {})
    return run
  }

  async function tickOnce(opts: { force?: boolean }) {
    for (const ch of chains) {
      try {
        await runChain(ch, opts.force ?? false)
      } catch (e) {
        config.onError?.(e as Error, ch.chainId)
      }
    }
  }

  function start(intervalMs = 15_000) {
    let running = false
    const t = setInterval(() => {
      if (running) return
      running = true
      void tick().finally(() => {
        running = false
      })
    }, intervalMs)
    return () => clearInterval(t)
  }

  return { tick, start }
}

/** §8.3 name: create and start the redeemer loop. */
export function startRedeemer(config: RedeemerConfig & { intervalMs?: number }): Redeemer & { stop: () => void } {
  const r = createRedeemer(config)
  const stop = r.start(config.intervalMs)
  return { ...r, stop }
}
