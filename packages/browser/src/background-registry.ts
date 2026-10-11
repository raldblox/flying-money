import type { ChainKey } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { idbKV } from './idb.js'

export const RECOVERY_TAG = 'fm-recovery-v1'
export const runtimeRegistry = () => idbKV('fm-runtime')
export async function registerTill(till: { chain: ChainKey; payee: Hex }) {
  await runtimeRegistry().set(`till:${till.chain}:${till.payee.toLowerCase()}`, JSON.stringify({ v: 1, ...till }))
  void requestBackgroundRecovery()
}

/** Best effort scheduling; the durable records, not the browser's wake-up support, are authoritative. */
export async function requestBackgroundRecovery(): Promise<boolean> {
  try {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return false
    const registration = await navigator.serviceWorker.getRegistration('/')
    const sync = (
      registration as (ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } }) | undefined
    )?.sync
    if (!sync) return false
    await sync.register(RECOVERY_TAG)
    return true
  } catch {
    return false
  }
}
