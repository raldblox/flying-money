import { isChainKey } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { RECOVERY_TAG, runtimeRegistry } from './background-registry.js'
import { recoverSettlements } from './settlement.js'
import { openTill } from './till.js'

export { RECOVERY_TAG, requestBackgroundRecovery } from './background-registry.js'

/** Same local seller engine and exclusive lock as the UI. No wallet vault, signing key or transaction sender. */
export async function runBackgroundRecovery(): Promise<{ waiting: boolean; checked: number }> {
  const registry = runtimeRegistry()
  let waiting = await recoverSettlements()
  let checked = 0
  const entries = await Promise.all(
    (await registry.keys('till:')).map(async (key) => ({
      key,
      value: JSON.parse((await registry.get(key))!) as { v: number; chain: string; payee: string; checkedAt?: number },
    })),
  )
  entries.sort((a, b) => (a.value.checkedAt ?? 0) - (b.value.checkedAt ?? 0))
  for (const { key, value } of entries) {
    if (value.v !== 1 || !isChainKey(value.chain) || !/^0x[0-9a-fA-F]{40}$/.test(value.payee)) continue
    let till: Awaited<ReturnType<typeof openTill>> | undefined
    try {
      till = await openTill(value.chain, value.payee as Hex, undefined, {
        lifecycle: false,
        background: false,
        lockAttempts: 1,
      })
      const accepted = await till.counter.reconcile()
      const collected = await till.syncCollected()
      if (accepted.waiting || collected.waiting) waiting = true
      checked++
    } catch {
      waiting = true
    } finally {
      await till?.release()
      await registry.set(key, JSON.stringify({ ...value, checkedAt: Date.now() }))
    }
  }
  await registry.set('last-recovery', JSON.stringify({ at: Date.now(), waiting, checked }))
  return { waiting, checked }
}
