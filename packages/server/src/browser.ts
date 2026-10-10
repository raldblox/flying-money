// Browser-safe entry (no Redis clients): the shop till runs the §6.5 logic in the page (§12.5, DECISIONS D21).
export {
  type Counter,
  type CounterConfig,
  type CounterKV,
  type CounterResult,
  type CounterStatus,
  createCounter,
  memoryKV,
  type RejectReason,
  type UnverifiedRecord,
} from './counter.js'
export { type MemoryStoreOptions, memoryStore, type StoreSnapshot } from './memory-store.js'
export { reconcileRedemptions } from './reconcile-redemptions.js'
export type { NoteStore, PendingRedemption, SellerState } from './store.js'
