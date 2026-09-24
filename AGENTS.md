# AGENTS.md — for coding agents working in this repository

**Source of truth:** `docs/BUILD_SPEC.md` (v1.4.1) is a sealed build contract. §6 (protocol), §7 (contract) and
§8 (SDK) are normative. Implementation decisions that resolve gaps in the spec are in `docs/DECISIONS.md`.
Progress is in `docs/STATUS.md`.

## Layout
- `contracts/`: Foundry (solc 0.8.24, OpenZeppelin **5.1.0** pinned, `evm_version = shanghai`)
- `packages/chains`: `@flying-money/chains`, the **only** place for chain IDs, RPCs, USDC addresses, explorers and caps
- `packages/{core,client,server,mcp,abi}`: TypeScript SDK (ESM, viem, amounts are `bigint`)
- `apps/{web,oracle,agent}`: Next.js site + app, Hono demo seller, demo buyer agent

## Commands (cross-platform; run from the repo root)
- `pnpm install`
- **`pnpm verify`**: the single gate before any deploy or submission (lint, clean build, typecheck incl. doc samples,
  all tests incl. forge invariants and S4 on Upstash when configured, secret scan, public-surface denylist).
  `pnpm verify --e2e` adds the Playwright suite. There is no hosted CI (§21.1).
- `pnpm build` / `pnpm typecheck` / `pnpm lint` / `pnpm test` (turbo, all packages)
- `pnpm contracts:test` (runs `forge test`, including invariants at 256 runs × depth 50)
- `pnpm --filter @flying-money/chains gen`: regenerate `packages/chains/registry/*.json` after editing the registry
- `pnpm --filter @flying-money/chains check`: read-only check of chain IDs and USDC decimals against live RPCs

## Invariants you must never weaken
- On-chain: I1–I7 (§7.4). Off-chain: C1 (§6.6), S1–S4 (§6.5). If a test for one of these fails, fix the code,
  never the invariant. If you can't, stop and report.
- Amounts are integer base units (`bigint` / `uint`), never floats.
- Spenders are ECDSA-only (no ERC-1271). The contract has no owner, admin, pause, fee or upgradeability.

## Never
- Push, or create remotes, tags or releases, unless the founder asks (§21.1). Commit locally per phase.
- Put a hackathon or event name on any public surface (§21.2). Event material lives in `docs/submissions/`.
- Hard-code a chain ID, RPC, USDC address, explorer or cap outside `packages/chains` (a test enforces this).
- Commit secrets or print private keys. Keys come only from env (`.env` is git-ignored; see `.env.example`).
- Send a mainnet transaction without explicit human approval.
- Reintroduce anything from BUILD_SPEC §4.2: simulated "World"/graph lab, shared spending pools, endorsement
  chains/lineages, bundle/state-root settlement, the multi-chain router or fake adapters, G1 sender-settled IOUs,
  offline cash between strangers.
- Read or port code from the `legacy-prototype` branch or `.legacy/`.
