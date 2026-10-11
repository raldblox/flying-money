# Flying Money browser primitives

`@flying-money/browser` is a workspace package with no React, Next.js, or demo dependency. It supplies the
browser capabilities used by Flying Money applications, composing the existing core/client/server engines and chain registry. It is not a second payment engine.

| Export | Responsibility |
| --- | --- |
| `idbKV(name)` / `KV` | IndexedDB string records, with strict write transactions that resolve after commit |
| `seal`, `unseal`, `sealKey`, `unsealKey`, `validPin` | The existing PIN-derived AES-GCM vault format |
| `holdLock(name)` / `LockBusyError` | One browser tab owns a wallet or till; unsupported environments fail closed |
| `createRecovery(options)` | Serialized recovery, retrying unresolved work with backoff from 2 to 60 seconds |
| `recoverWhileOpen(options)` | Recovery on startup, connection return, focus, and visibility resume |

Supply `reconcile(): Promise<boolean>` with an idempotent adapter. Return `true` when a check is still unresolved;
return `false` when the current pass is complete. Exceptions retry too. `onState` receives `checking`, `waiting`, or
`current`. These describe recovery checks, **not** payment approval, delivery, or settlement.

`createRecovery` starts when `wake()` is called. Multiple wakes cannot run the adapter concurrently.
`stop()` prevents further work and waits for an in-flight adapter; retain the storage lock until it resolves.
`recoverWhileOpen` starts immediately and returns an asynchronous cleanup function.

Use `@flying-money/client/counter` for signing, pending payments, receipt confirmation, and available balance.
Use `@flying-money/server/browser` for acceptance, replay protection, risk limits, durable seller accounting, and
`reconcileRedemptions`. A transport must carry the exact persisted signed payload; it must not create another one
after a timeout. The recovery scheduler does not authorize any spending or send transactions.

The web app keeps its existing database names, object store, and sealed-key format. Existing records keep their format; wallet initialization adds a schema marker without deleting data. UI and browser permission prompts remain in `apps/web`.

## Limits

- `background` can run the same recovery engines inside a service worker. Background Sync is optional and browser-controlled; reopening the app is the universal fallback.
- IndexedDB is device-local storage, not a backup. Browser clearing, eviction, and device loss remain risks.
- The vault keeps its existing PIN security characteristics. A short PIN does not replace a strong backup passphrase
  or protect an unlocked origin from malicious scripts. This extraction is not a security audit.
- Browser locks coordinate tabs on one origin and device, not multiple devices. The seller still needs one
  authoritative ledger.
- Service-worker caching and installation policy belong to the host application. Do not cache signing keys,
  authenticated API responses, or RPC responses in an offline shell.

Build and test from the repository with `pnpm --filter @flying-money/browser build` and
`pnpm --filter @flying-money/browser test`.

## Reusable runtime entry points

- `wallet`: `createWalletRepository` for injected storage/certificate readers; `openWalletRepository` for an exclusively owned browser session. Call `release()` and await draining before handing ownership over.
- `wallet-backup`, `wallet-history`, `handover`: existing interoperable formats, atomic confirmation/history, validated all-or-nothing imports.
- `till`: `openTill` owns persistence and lifecycle; inject `readCertificate` for a host adapter. Custom simulated demos should set `background: false`. `cacheCertificate` primes offline acceptance without exposing the underlying mutable server.
- `settlement`: journal intent before sending, persist its hash, then observe confirmations. There is no automatic send callback. `recoverSettlements` accepts an injected public client.
- `background`: `runBackgroundRecovery` checks registered tills and saved collection hashes using the same engines and locks; `requestBackgroundRecovery` registers a best-effort browser wake-up.
- `storage-health`: inspect storage and request persistence from a user action. A grant is not a backup.
- `carry/*`: payload codecs, receipt framing, sound, QR stream, same-origin channel and `preparedDelivery` with a replaceable carrier interface. A retry carries the same saved bytes.
- `operationScope`: reject new operations while closing, then drain already-started work.

`AtomicKV.atomic` callbacks must be synchronous; throwing aborts every change. Use it for related payment state and history, not network calls or signing.
