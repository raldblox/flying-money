import { createWalletHistory } from '@flying-money/browser/wallet-history'

export type { WalletPayment } from '@flying-money/browser/wallet-history'
export const { listPayments, recordPayment } = createWalletHistory()
