import type { CertKey, Hex } from '@flying-money/core'
import type { NoteStore } from './store.js'

/**
 * Refresh accounting from a trusted chain reader. Submission is not proof of redemption: redeemMany can skip notes.
 * No transaction is sent. A zero hash denotes a chain read with no known originating transaction, as in the redeemer.
 */
export async function reconcileRedemptions(
  store: Pick<NoteStore, 'markRedeemed'>,
  keys: CertKey[],
  readRedeemed: (key: CertKey) => Promise<bigint | null>,
  txHash: Hex = `0x${'0'.repeat(64)}`,
): Promise<{ checked: number; waiting: number }> {
  let checked = 0
  let waiting = 0
  for (const key of new Set(keys)) {
    try {
      const redeemed = await readRedeemed(key)
      if (redeemed === null || redeemed < 0n) {
        waiting++
        continue
      }
      await store.markRedeemed(key, redeemed, txHash)
      checked++
    } catch {
      waiting++
    }
  }
  return { checked, waiting }
}
