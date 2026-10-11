import type { ChainKey } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { type AtomicKV, idbKV } from './idb.js'

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

export interface KeepsakeData {
  serial: string
  name: string
  issuedAt: string
  paid: string
  chainId: number
  certificateId: string
  proverb: { text: string; source: string }
}

const KEY = 'history'

export function createWalletHistory(db: AtomicKV = idbKV('fm-wallet')) {
  async function listPayments(): Promise<WalletPayment[]> {
    const raw = await db.get(KEY)
    return raw ? (JSON.parse(raw) as WalletPayment[]) : []
  }
  async function recordPayment(payment: WalletPayment) {
    await db.atomic((records) => {
      const all = JSON.parse(records.get(KEY) ?? '[]') as WalletPayment[]
      if (all.some((p) => p.id.toLowerCase() === payment.id.toLowerCase() && p.chain === payment.chain)) return
      records.set(KEY, JSON.stringify([payment, ...all].slice(0, 500)))
    })
  }
  return { listPayments, recordPayment }
}
