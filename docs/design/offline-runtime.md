# Offline runtime and recovery boundaries

Source review and first implementation pass: 10 October 2026.

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
| Wallet schema, backup and history presentation | `apps/web/lib/wallet*` | Still app-owned |
| QR, sound, share, file and same-origin tab delivery | `apps/web/lib/carry`, carry components | Still app-owned; next extraction boundary |
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

## Next work, in priority order

1. **Persist browser settlement jobs.** Save transaction hashes, network, certificate keys and confirmation progress
   before showing submission. Handle refresh, replacement, revert, partial batch success and reorg policy explicitly.
   This pass recovers observed chain balances after reopening, but does not introduce a browser transaction outbox.
2. **Finish the browser ownership lifecycle.** Give all manual operations a shared cancellation/drain contract,
   including an in-flight acceptance during navigation. Automatic recovery is drained here; every manual operation
   must get the same lifecycle guarantees before claiming a fully managed standalone runtime.
3. **Extract carrier adapters.** Move pure codecs and delivery interfaces into a package; keep camera, microphone,
   React views and permission prompts in host adapters. Separate transport delivery acknowledgement from a verified
   seller receipt. Test duplicated, reordered, interrupted and truncated messages against the same pending note.
4. **Extract the wallet repository.** Version the existing schema without changing database names; expose atomic
   payment/history operations, backup/import validation, storage health and persistence requests. Preserve migration
   fixtures from real older formats before shipping changes.
5. **Make install/update/storage recovery a first-class journey.** Show an available update without interrupting a
   pending payment. Add quota, eviction, failed-open, and upgrade-blocked tests; request persistent storage with
   truthful grant status. See [MDN: persist](https://developer.mozilla.org/en-US/docs/Web/API/StorageManager/persist).
6. **Validate installed devices.** Test Android Chrome and iOS Safari standalone mode, physical airplane mode,
   overnight suspension, process termination, two-device carriers, and a version upgrade with a pending payment.

Background Sync is a possible wake-up adapter for compatible browsers, not the source of truth or a signing service.
It has limited browser support, so closed-app automatic sync cannot be promised everywhere. A worker must not unlock
a PIN vault or create a new spending decision. See
[MDN: Background Synchronization](https://developer.mozilla.org/en-US/docs/Web/API/Background_Synchronization_API).

## Verification

Regression tests cover missing Web Locks, recovery serialization/retry/drain, chain-observed redemption amounts,
cross-application cache isolation, wrong-route fallback, and RSC/HTML separation. The production PWA suite exercises
actual browser offline reload, persisted wallet setup, uncached routes and a second tab. Run it after a production
build using `pnpm --filter @flying-money/web e2e:pwa`; the normal development-server suite does not enable the worker.

These automated checks do not establish physical-device behavior, full closed-app sync, or an audited security
guarantee. The existing C1 and S1–S4 engines and contract invariants remain the required release gate.
