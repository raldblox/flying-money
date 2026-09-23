# Build status

Spec: `docs/BUILD_SPEC.md` v1.4.1 · Decisions: `docs/DECISIONS.md` · Plan: §17 Sprint A (deadline **4 Oct 2026**)

## Phase 1: Reset + skeleton + CI + `@flying-money/chains` (23 Sep): ✅ local

**Done**
- §4 reset: done before this build (H10 confirmed; legacy on branch `legacy-prototype` and in the ignored `.legacy/`).
- §0.2 toolchain:
  - Foundry 1.3.5, solc **0.8.24**, `evm_version = shanghai`, optimizer 200, invariant runs 256 × depth 50.
  - Submodules: forge-std v1.10.0 and **OpenZeppelin v5.1.0** (`69c8def`).
- Monorepo:
  - pnpm workspaces + turbo, TypeScript 7.0, Biome lint, vitest.
  - `packages/{core,client,server,mcp,abi,chains}` and `apps/{web,oracle,agent}` exist; everything except `chains` is a placeholder.
- `@flying-money/chains`:
  - All 9 registry keys with the §5.4 values, plus `maxTotalOutstanding` (D1).
  - RPC env overrides (`RPC_<KEY>`), `getChain` / `getChainById`, and runtime registration for anvil only.
  - Generated `registry/<key>.json` files for the forge deploy script (D2).
- CI (`.github/workflows/ci.yml`): gitleaks secret scan, forge build and tests, and lint + build + typecheck + tests. The TS job has a Redis service for the S4 tests (D11).
- Docs: `AGENTS.md`, `.env.example` (Upstash vars added), `LICENSE` (MIT), `docs/DECISIONS.md` (D1–D12).

**Test results**
- `@flying-money/chains`: **18/18 pass**. This includes:
  - every §5.4 value;
  - the cap rules;
  - freshness of the generated registry files;
  - a repo-wide guard that no USDC address or spec RPC appears outside `packages/chains`.
- `pnpm build`, `pnpm typecheck` and `pnpm lint` pass locally. `forge build` works; there are no contracts yet (they come in Phase 2).
- **Live registry check** (`pnpm --filter @flying-money/chains check`, read-only): all 8 public chains match. `eth_chainId` equals the registry, and USDC `decimals() = 6`, on Arbitrum One/Sepolia, Base/Sepolia, Monad 143/10143 and Arc 5042/5042002. Arc Testnet answers on both `rpc.testnet.arc.io` (the spec's) and `rpc.testnet.arc.network` (viem's).
- CI hasn't run on GitHub yet: nothing is pushed (push only when asked). The same commands pass locally, except `forge test`, which has no tests until Phase 2.

**Blocked:** nothing.

**Human inputs needed next**
- **H1:** testnet `DEPLOYER_KEY` with Arbitrum Sepolia ETH, for the Phase 2 deploy.
- **H4:** Arbiscan API key (`EXPLORER_API_KEYS`), for verification.
- Soon, for Phase 4 (29 Sep): **H2** (Circle testnet USDC on the demo funder) and **H3** (`PAYEE_ADDRESS`, `REDEEMER_KEY` with gas).
- Optional: a free **Upstash** Redis database (`UPSTASH_REDIS_REST_URL` / `TOKEN`) to run the S4 Redis tests locally. CI covers them without it.

**Next:** Phase 2, the contract. Write the unit tests (§7.4 1–14b) and invariants (I1–I7) first, then §7.2 exactly, MockUSDC, the Deploy script and the gas snapshot.
