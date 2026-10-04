# AGENTS.md: notes for coding agents (and humans) working in this repository

Start with [CONTRIBUTING.md](CONTRIBUTING.md). The public specification is in `docs/site/`:
[protocol](docs/site/protocol.md) (wire format, seller and buyer algorithms), [contract](docs/site/contract.md)
(functions, caps, invariants), and the SDK references ([client](docs/site/client.md), [server](docs/site/server.md),
[MCP](docs/site/mcp.md)). The threat model and test evidence are in [docs/SECURITY.md](docs/SECURITY.md).

Code comments sometimes cite section numbers (`§6.5`) or decision numbers (`D32`) from the maintainers' internal
design record. Treat them as labels; the public docs above describe the same behaviour.

## Layout
- `contracts/`: Foundry (solc 0.8.24, OpenZeppelin **5.1.0** pinned, `evm_version = shanghai`)
- `packages/chains`: `@flying-money/chains`, the **only** place for chain IDs, RPCs, USDC addresses, explorers and caps
- `packages/{core,client,server,mcp,abi}`: TypeScript SDK (ESM, viem, amounts are `bigint`)
- `apps/{web,oracle,agent}`: Next.js site + app, Hono demo seller, demo buyer agent

## Commands (cross-platform; run from the repo root)
- `pnpm install`
- **`pnpm verify`**: the gate before any change is merged (lint, clean build, typecheck incl. doc samples, all tests incl.
  forge invariants, secret scan, public-surface checks). `pnpm verify --e2e` adds the Playwright suite.
- `pnpm build` / `pnpm typecheck` / `pnpm lint` / `pnpm test` (turbo, all packages)
- `pnpm contracts:test` (runs `forge test`, including invariants at 256 runs × depth 50)
- `pnpm --filter @flying-money/chains gen`: regenerate `packages/chains/registry/*.json` after editing the registry
- `pnpm --filter @flying-money/chains check`: read-only check of chain IDs and USDC decimals against live RPCs

## Invariants you must never weaken
- On-chain: I1–I7 ([contract](docs/site/contract.md)). Off-chain: C1 (buyer never signs above what it owes) and S1–S4
  (seller idempotency, reservation and replay rules; see [SECURITY.md](docs/SECURITY.md)). If a test for one of these
  fails, fix the code, never the test's assertion. If you can't, stop and report.
- Amounts are integer base units (`bigint` / `uint`), never floats.
- Spenders are ECDSA-only (no ERC-1271). The contract has no owner, admin, pause, fee or upgradeability.

## Never
- Hard-code a chain ID, RPC, USDC address, explorer or cap outside `packages/chains` (a test enforces this).
- Commit secrets or print private keys. Keys come only from env (`.env` is git-ignored; see `.env.example`).
- Send a mainnet transaction without explicit human approval.
- Add a feature that weakens the core promise: a budget pays one seller, from one spending key, up to its amount, until
  its end date, and can't be cancelled early.
