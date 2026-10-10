# Flying Money browser primitives

`@flying-money/browser` is a workspace package with no React, Next.js, demo, or chain dependency. It supplies the
browser capabilities used by Flying Money applications. It is not a second payment engine.

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

The web app keeps its existing database names, object store, and sealed-key format. Existing data is not migrated
or deleted by this extraction. The app-specific wallet record schema, carry codecs, and UI remain in `apps/web`.

## Limits

- An open page is required for this recovery adapter. It is not a guarantee of execution after the app is closed.
- IndexedDB is device-local storage, not a backup. Browser clearing, eviction, and device loss remain risks.
- The vault keeps its existing PIN security characteristics. A short PIN does not replace a strong backup passphrase
  or protect an unlocked origin from malicious scripts. This extraction is not a security audit.
- Browser locks coordinate tabs on one origin and device, not multiple devices. The seller still needs one
  authoritative ledger.
- Service-worker caching and installation policy belong to the host application. Do not cache signing keys,
  authenticated API responses, or RPC responses in an offline shell.

Build and test from the repository with `pnpm --filter @flying-money/browser build` and
`pnpm --filter @flying-money/browser test`.
