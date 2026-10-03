# Public review readiness — 3 October 2026

Scope: pending public-repository documentation and submission artifacts at source commit `6080946`. This is not an independent security audit, full Git-history secret audit, live deployment verification or release approval.

## Checks performed

| Check | Result | Limit |
|---|---|---|
| `pnpm verify` | Passed | Fresh web build; Turbo reused all 17 test tasks. Cached success is not fresh test evidence. |
| Direct uncached inbox tests | **Failed: 19 passed, 1 failed** | Redis mock owner-list test returned an empty list. Upstash was not configured in this direct invocation. |
| Repository secret scanner | Passed | Pattern/env-value scan, not proof that no secret exists anywhere in history or binary artifacts. |
| Public-surface check | Passed during verify | Built site checked; event materials remain under docs/submissions. |
| Browser e2e | Not rerun | No new end-to-end browser or transaction success claimed. |

## Release blocker: inbox test

`pnpm --filter @flying-money/server exec vitest run test/inbox.test.ts` reproduces the failure in `an owner sees only its own requests` at `packages/server/test/inbox.test.ts:293`. The expected owner's request is missing; this result does not demonstrate exposure of another owner's request.

The prior 2 October review identified a likely mismatch between the fixture's injected clock and real-time pruning in the Redis owner index, and reported failures in both Redis mock and Upstash. This review freshly reproduces the mock failure only. Diagnose and fix without weakening ownership or expiry assertions, then rerun uncached tests and the full gate with browser coverage before claiming release readiness.

## Other evidence limits

- No independent security audit; testnet only. Do not use real-value production funds on the basis of this review.
- The previous review reported an unavailable public MCP npm package. Publication was not rechecked here; the root README supplies a local-build CLI route instead of assuming npm availability. Validate agent onboarding from a fresh checkout.
- Previously reported browser-test shutdown issues were not retested here.
- Final videos, organizer eligibility and actual submission confirmation were not verified in this review.
- No throughput benchmark, customer adoption, paid usage, or completed x402/MPP adapter is claimed.

## Publication selection

The public commit contains a concise judge index, the existing revision-5 pitch PDF, this limitations record, and clearer README/security wording. Runtime and protocol code are unchanged.

Local production drafts, duplicate media, generation scripts and private review notes remain on disk but are ignored. An older untriaged working audit is also kept local; it must not be mistaken for a current independent audit. These exclusions do not resolve findings or certify the protocol. Current reproduced blockers are disclosed above.
