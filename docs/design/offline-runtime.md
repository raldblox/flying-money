# Offline runtime and recovery boundaries

Implementation and recovery integration: 11 October 2026.

Flying Money applications should compose a shared payment engine, durable local state, and replaceable transport and
settlement adapters. The PWA is one host for these primitives. The demo supplies sponsored budgets and a story; it
must use the same acceptance and accounting rules as an actual till.

## Current ownership

| Capability | Owner | Status |
| --- | --- | --- |
| Wire formats, signatures, certificate reads | `packages/core` | Shared already |
| Chain addresses, endpoints, limits | `packages/chains` | Shared already; sole registry |
| Buyer accounting and durable HTTP outbox | `packages/client` | Shared already |
| Counter signing, pending note, receipt confirmation | `packages/client/src/counter.ts` | Shared already; signed note is saved before it is returned |
| Seller acceptance, idempotency, risk limits, reconciliation | `packages/server/src/counter.ts` and store implementations | Shared already |
| Browser storage, PIN vault, exclusive access, reconnect scheduling | `packages/browser` | Extracted in this pass; adopted by the web wallet and till |
| Observed collection accounting | `packages/server/src/reconcile-redemptions.ts` | Added in this pass; used by real and demo tills |
| Wallet schema, atomic payment/history, validated backup restore | `packages/browser/wallet*` | Shared; web modules are host adapters |
| Payload codecs, sound/QR framing and same-origin tab delivery | `packages/browser/carry/*` | Shared; React and permission prompts stay in the host |
| Install experience and offline page cache | `apps/web` manifest, worker and components | Host-specific; hardened in this pass |

No new ledger is introduced. Both demo and real tills use `openTill`, `createCounter`, and the same persistent store.
The agent uses the client/server engines; browser lifecycle code is not appropriate for its server runtime.

## Recovery contract

1. Prepare and persist the signed payment using the existing buyer engine before offering it to a transport.
2. Retry the same pending payload. A missing acknowledgement does not authorize a new signature or free its balance.
3. Recheck locally accepted, unverified payments through the seller engine when connectivity returns.
4. Refresh collected amounts from a trusted chain reader. A submitted or successful batch transaction alone does
   not prove that each note was redeemed; `redeemMany` can skip notes.
5. Keep failed checks pending and retry. Expose checking/waiting/current status separately from collection status.
6. Collection remains an explicit transaction. Reconnection does not approve new spending or unattended gas use.

The browser runtime runs a single recovery pass at a time. It wakes on page startup, online events, focus and visible
resume, and retries unresolved checks with bounded delay. The till keeps its lock until automatic recovery finishes
during cleanup. The counter demo's cut-connection adapter remains respected, and restoring it explicitly wakes
recovery. Wallet chain balances are keyed by network and certificate, avoiding cross-network display collisions.

The browser's online flag is a hint, not proof that an RPC is reachable; the operation result determines whether a
retry is needed. See [MDN: Navigator.onLine](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/onLine).

## Offline cache changes

- Offline readiness requires a successful worker acknowledgement after saving the exact page and its loaded build
  assets. Worker registration alone is insufficient.
- Navigations fall back only to their own cached URL. An unknown till cannot become the shop landing page or wallet.
- React Server Component requests do not fall back to HTML.
- Cleanup only removes Flying Money shell caches; it preserves other applications' caches on the origin.
- An updated worker waits for existing clients instead of immediately replacing their active worker.
- Runtime cache writes are awaited. Failed writes do not break a successful online response.

Shell preparation does not make online funding, certificate issuance, oracle requests, or settlement work offline.
The worker deliberately excludes API, RPC, cross-origin, and non-GET requests. Device storage is not a backup.

## Durable recovery now implemented

- `settlementJournal` writes an intent before broadcast, records submitted and replacement hashes, and blocks overlapping unresolved collections. Reloads observe the saved transaction; they never send again. Canonical receipts are checked against their block and require two observed confirmations by default. A missing previously observed receipt becomes `needs-attention`. This is a confirmation policy, not irreversible finality.
- Real till collection exposes saved jobs, explorer links and explicit resolution for an intent with no hash. A supplied replacement hash must target Flying Money and include the saved certificate IDs. The ledger continues to use observed redeemed amounts, including partial batches.
- The sponsored counter records its collection ID in durable server storage before sending and saves the returned hash before responding. Repeating an ID cannot send another transaction. The browser recovers a lost response through a read-only status endpoint. If a server dies between broadcast and recording its hash, the record remains unresolved; it must be investigated rather than automatically resent.
- `openTill` drains acceptance, reconciliation, certificate caching and writes before releasing ownership. `openWalletRepository` holds the wallet lock through started repository writes and refuses late writes after closing.
- Wallet confirmation uses the existing client transition and commits its resulting state and history atomically. Export reads a consistent snapshot. Restore validates all records before a single transaction imports them. Database names, encrypted key format, and v1/v2 backup containers are preserved; a schema marker rejects newer unsupported versions.
- Carrier implementations now live in the browser package. `preparedDelivery` fixes the payload across retries. Delivery acknowledgements are not seller acceptance or on-chain settlement. Face-to-face receipt codes retain their existing trust model.
- The production service worker bundles the same till and settlement engines. Background Sync checks saved records where supported; it does not unlock keys, sign, or submit collection transactions. UI and worker share the same exclusive till lock. The counter demo's simulated connection cut disables worker registration for its tills.
- Offline status exposes installation guidance, a user-triggered persistent-storage request with truthful grant status, and a waiting-update notice. Updates do not forcibly take over an active payment.

Background Sync has limited browser support and the OS controls scheduling. Reopening the app remains the fallback.
See [MDN: Background Synchronization](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API)
and [MDN: persistent storage](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).

## Physical-device release checklist

Still requires Android Chrome and iOS Safari installed-mode verification: airplane mode, overnight suspension,
process termination, two-device QR/sound delivery, and updating with a pending payment. Automated desktop browser
checks cannot establish these results. Clearing origin storage or losing the device still requires a backup.

## Verification

Regression tests cover atomic rollback/concurrency, failed-open retry, unchanged pending payloads in legacy/encrypted restores, settlement duplicate guards/replacements/reverts/reorg observation, carrier retry/cancellation, missing Web Locks, recovery serialization/retry/drain, chain-observed redemption amounts,
cross-application cache isolation, wrong-route fallback, and RSC/HTML separation. The production PWA suite exercises
actual browser offline reload, persisted wallet setup, uncached routes, a second tab, and worker execution after the wallet page closes (an empty saved till; not an OS wake-up guarantee). Run it after a production
build using `pnpm --filter @flying-money/web e2e:pwa`; the normal development-server suite does not enable the worker.

These automated checks do not establish physical-device behavior, full closed-app sync, or an audited security
guarantee. The existing C1 and S1–S4 engines and contract invariants remain the required release gate.
