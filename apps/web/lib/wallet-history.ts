import type { ChainKey } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import type { KeepsakeData } from '@/components/carry/keepsake'
import { kv } from './wallet'

/**
 * What this wallet has paid, kept on this device only: one line per payment, with what was bought when the till's
 * receipt said so (and, in the demo, the 飛錢 certificate itself). The budget's balance comes from the budget; this
 * is the story behind it.
 */
export interface WalletPayment {
  /** the slip's memo: one per payment */
  id: Hex
  certificateId: Hex
  chain: ChainKey
  at: number
  /** USDC base units */
  price: string
  item?: string
  /** what the till said: checked by the till, or taken at its own risk; "confirmed" when answered by hand */
  status: 'GUARANTEED' | 'UNVERIFIED' | 'CONFIRMED'
  keepsake?: KeepsakeData
}

const KEY = 'history'

export async function listPayments(): Promise<WalletPayment[]> {
  try {
    const raw = await kv().get(KEY)
    return raw ? (JSON.parse(raw) as WalletPayment[]) : []
  } catch {
    return []
  }
}

/** Records a payment once (the same slip answered twice is one payment). Newest first. */
export async function recordPayment(p: WalletPayment): Promise<void> {
  const all = await listPayments()
  if (all.some((x) => x.id.toLowerCase() === p.id.toLowerCase())) return
  await kv().set(KEY, JSON.stringify([p, ...all].slice(0, 500)))
}
