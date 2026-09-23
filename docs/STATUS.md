# Build status

Spec: `docs/BUILD_SPEC.md` v1.4.1 · Decisions: `docs/DECISIONS.md` · Plan: §17 Sprint A (deadline **4 Oct 2026**)

## Phase 2: Contract + unit tests + invariants + Deploy script (23 Sep): ✅ local · ⏸ deploy blocked on H1/H4

**Done** (tests written before the contract, per §0.3)
- `contracts/src/FlyingMoney.sol`: **byte-for-byte the §7.2 reference** (checked with `diff` against the spec).
- `contracts/src/MockUSDC.sol` per §7.3: 6 dp, `mUSDC`, `faucet()` gives 100 with a 1 h per-address cooldown, no owner mint.
- Test fixtures: a fee-on-transfer token, a re-entrant token, an ERC-1271 garbage-accepting code for `vm.etch`, and a transfer-tracking token for the invariants.
- `script/Deploy.s.sol` + `pnpm deploy:chain <key>` / `pnpm deploy:all` (`scripts/deploy.ts`, cross-platform):
  - Constructor arguments come from the registry.
  - Guards:
    - reverts `RegistryMismatch("chainId")` if the RPC's chain ID ≠ the registry's;
    - checks USDC `decimals() == 6` and that it has code;
    - a mainnet needs `--confirm-mainnet` (§0.1) and non-zero caps.
  - Records `flyingMoney` and `deployedBlock` in `packages/chains/src/deployments.json`, from the broadcast receipt.
  - `DEPLOYER_KEY` is read from env only and never printed.
- `docs/SECURITY.md`: guarantees, threat model, test evidence and gas.

**Test results:** `forge test` gives **41/41 pass**.
- 24 FlyingMoney unit tests cover §7.4 #1–#14b; 1 MockUSDC test.
- **16 invariant tests: I1, I2, I2b, I3, I4, I5, I6, I7**, each at **256 runs × depth 50 (12,800 calls)**, against an uncapped and a capped (300 / 1,000) deployment.
- One handler bug (a doubled ghost count when a certificate appeared twice in one batch) was fixed in the *test*. No contract or invariant was changed.
- Gas: `redeem` 85,758; `redeemMany`(10) 328,192.
- Deploy on local anvil: ✅. The mainnet refusal and chain-ID mismatch guards were both shown to stop the deploy.

**Blocked:** deploy and verify on **Arbitrum Sepolia** (the rest of this row's ✅) needs:
- **H1:** `DEPLOYER_KEY` in `.env`, funded with Arbitrum Sepolia ETH;
- **H4:** an Etherscan-family API key in `EXPLORER_API_KEYS` (Etherscan API v2 keys cover Arbiscan and Basescan).

Then run `pnpm deploy:chain arbitrum-sepolia --verify`.

**Next:** Phase 3, the SDK (core, client, server). Write the property tests C1, S1, S3, S4, the sweeper, redeem-only-served, store-loss and parity tests first. Then the anvil integration run: 50 requests → ≤3 redeems.

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
