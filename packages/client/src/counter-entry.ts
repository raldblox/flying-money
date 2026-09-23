// Browser-safe entry (no file store): the customer wallet at a counter (§6.8, DECISIONS D20).
export { InsufficientBudgetError, NoCertificateError, PendingUnresolvedError } from './client.js'
export {
  abandonCounterPayment,
  type CounterCertificate,
  type CounterPending,
  type CounterState,
  type CounterWalletStore,
  certificateMatches,
  confirmCounterPayment,
  counterBalance,
  deserializeCounterState,
  memoryCounterStore,
  prepareCounterPayment,
  serializeCounterState,
} from './counter.js'
