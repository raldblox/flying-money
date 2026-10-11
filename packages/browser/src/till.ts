import { registerTill, requestBackgroundRecovery } from './background-registry.js'
import { operationScope } from './lifecycle.js'
import { holdLock } from './locks.js'
import { createRecovery, type RecoveryState } from './recovery.js'

export { holdLock, LockBusyError as TillBusyError } from './locks.js'

import { type ChainKey, getChain } from '@flying-money/chains'
import {
  type Counter,
  type CounterConfig,
  createCounter,
  memoryStore,
  reconcileRedemptions,
  type StoreSnapshot,
} from '@flying-money/server/browser'
import type { Hex } from 'viem'
import { loadCertificate } from './chain-reader.js'
import { idbKV, type KV } from './idb.js'

/** Till settings (§12.5 step 4), kept on this device. */
export interface TillSettings {
  name: string
  /** USDC base units, as a decimal string. Default 5 USDC. */
  firstVisitLimit: string
  /** USDC base units. The most this till accepts unverified in total while offline (D34). Default 20 USDC. */
  offlineFloat: string
  /** "Tea 3.50" per line. */
  priceList: string
  primary: boolean
}
export const DEFAULT_SETTINGS: TillSettings = {
  name: 'My shop',
  firstVisitLimit: '5000000',
  offlineFloat: '20000000',
  priceList: 'Tea 3.50\nDumplings 6.00\nMooncake 2.25',
  primary: true,
}

export interface Till {
  payee: Hex
  cacheCertificate: Counter['server']['certificate']
  counter: Pick<Counter, 'accept' | 'reconcile' | 'unverified' | 'priceQr' | 'decodePrice' | 'accepts'>
  store: ReturnType<typeof memoryStore>
  kv: KV
  settings: TillSettings
  saveSettings(s: TillSettings): Promise<void>
  syncCollected(txHash?: Hex): Promise<{ checked: number; waiting: number }>
  recover(): Promise<void>
  subscribeRecovery(listener: (state: RecoveryState) => void): () => void
  release(): Promise<void>
}

/**
 * Opens the till for one shop. Its seller state is a memoryStore saved to IndexedDB on every write (D21).
 * Only one tab may hold it (Web Locks), because two in-memory copies would stop being authoritative (§6.8).
 */
export async function openTill(
  chain: ChainKey,
  payee: Hex,
  name?: string,
  /** reads a budget on-chain; the demo till passes one that can pretend to be offline */
  opts: {
    readCertificate?: CounterConfig['readCertificate']
    background?: boolean
    lifecycle?: boolean
    lockAttempts?: number
  } = {},
): Promise<Till> {
  const id = `fm-till:${chain}:${payee.toLowerCase()}`
  const release = await holdLock(id, opts.lockAttempts)
  const scope = operationScope()
  try {
    const kv = idbKV(id)
    const snap = await kv.get('store')
    const settingsRaw = await kv.get('settings')
    const settings: TillSettings = settingsRaw
      ? { ...DEFAULT_SETTINGS, ...(JSON.parse(settingsRaw) as Partial<TillSettings>) }
      : { ...DEFAULT_SETTINGS, ...(name ? { name } : {}) }
    const store = memoryStore({
      ...(snap ? { initial: JSON.parse(snap) as StoreSnapshot } : {}),
      onCommit: (s) => kv.set('store', JSON.stringify(s)),
    })
    const counter = createCounter({
      chain,
      payee,
      store,
      kv: { get: kv.get, set: kv.set, keys: kv.keys },
      firstVisitLimit: BigInt(settings.firstVisitLimit),
      offlineFloat: BigInt(settings.offlineFloat),
      ...(opts.readCertificate ? { readCertificate: opts.readCertificate } : {}),
    })
    const syncCollected = async (txHash?: Hex) => {
      const network = getChain(chain)
      const pending = await store.pendingRedemptions(network.chain.id)
      return reconcileRedemptions(
        store,
        pending.map((p) => p.key),
        async (key) => {
          const certificateId = key.split(':')[1] as Hex
          const certificate = opts.readCertificate
            ? await opts.readCertificate(network.chain.id, network.flyingMoney!, certificateId)
            : await loadCertificate(chain, certificateId)
          return certificate?.redeemed ?? null
        },
        txHash,
      )
    }
    if (opts.background !== false) await registerTill({ chain, payee })
    let recoveryState: RecoveryState = 'waiting'
    const listeners = new Set<(state: RecoveryState) => void>()
    const recovery = createRecovery({
      reconcile: () =>
        scope.run(async () => {
          const checks = await counter.reconcile()
          const collected = await syncCollected()
          return checks.waiting > 0 || collected.waiting > 0
        }),
      onState: (state) => {
        recoveryState = state
        for (const listener of listeners) listener(state)
      },
    })
    const managedCounter = {
      priceQr: counter.priceQr,
      decodePrice: counter.decodePrice,
      accepts: counter.accepts,
      unverified: counter.unverified,
      reconcile: () => scope.run(counter.reconcile),
      accept: (...args: Parameters<Counter['accept']>) =>
        scope.run(async () => {
          const result = await counter.accept(...args)
          if (result.status === 'UNVERIFIED') void recovery.wake()
          if (opts.background !== false) void requestBackgroundRecovery()
          return result
        }),
    }
    const wake = () => {
      void recovery.wake()
    }
    const visible = () => {
      if (document.visibilityState === 'visible') wake()
    }
    const lifecycle = opts.lifecycle !== false && typeof window !== 'undefined'
    if (lifecycle) window.addEventListener('online', wake)
    if (lifecycle) window.addEventListener('focus', wake)
    if (lifecycle) document.addEventListener('visibilitychange', visible)
    if (lifecycle) wake()
    return {
      payee,
      cacheCertificate: (...args) => scope.run(() => counter.server.certificate(...args)),
      counter: managedCounter,
      store: {
        ...store,
        begin: (...args) => scope.run(() => store.begin(...args)),
        finish: (...args) => scope.run(() => store.finish(...args)),
        recover: (...args) => scope.run(() => store.recover(...args)),
        markRedeemed: (...args) => scope.run(() => store.markRedeemed(...args)),
        setSubmission: (...args) => scope.run(() => store.setSubmission(...args)),
      },
      kv: {
        ...kv,
        set: (key, value) => scope.run(() => kv.set(key, value)),
        del: (key) => scope.run(() => kv.del(key)),
      },
      settings,
      saveSettings: (s) => scope.run(() => kv.set('settings', JSON.stringify(s))),
      syncCollected: (hash) => scope.run(() => syncCollected(hash)),
      recover: recovery.wake,
      subscribeRecovery: (listener) => {
        listeners.add(listener)
        listener(recoveryState)
        return () => {
          listeners.delete(listener)
        }
      },
      release: async () => {
        if (lifecycle) window.removeEventListener('online', wake)
        if (lifecycle) window.removeEventListener('focus', wake)
        if (lifecycle) document.removeEventListener('visibilitychange', visible)
        listeners.clear()
        const drain = scope.close()
        await Promise.allSettled([recovery.stop(), drain])
        release()
      },
    }
  } catch (error) {
    release()
    throw error
  }
}

/** "Tea 3.50" lines → items. Amounts are parsed as exact decimals (never floats). */
export function parsePriceList(s: string): Array<{ label: string; amount: string }> {
  return s
    .split('\n')
    .map((l) => l.trim())
    .map((l) => /^(.*\S)\s+(\d+(?:\.\d{1,6})?)$/.exec(l))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ label: m[1]!, amount: m[2]! }))
}

export const newOrderId = () =>
  `o-${Date.now().toString(36)}-${crypto.getRandomValues(new Uint32Array(1))[0]!.toString(36)}`
