# Spec change notice: v1.5 → v1.6 (27 Sep 2026)

**For the implementing agent.** `docs/BUILD_SPEC.md` is now **v1.6**. Everything new is in **§22** (normative, final), and §22 wins where it conflicts with §21 or earlier sections.

**Unchanged:** the contract (§7), the protocol and wire formats (§6), invariants I1–I7, C1, S1–S4 and R1–R5, and decisions D1–D41.

| # | Change | Section |
|---|---|---|
| W1 | The product review is decided (P01–P16): improve the funded-budget product. No savings, converter or compatibility implementation now. | §22.1 |
| W2 | Release blockers A1–A5, tests first. **A1 corrects a spec defect:** §21.5's 30-day outcome TTL; replay tombstones now live with the certificate (S1). | §22.2, §21.5 |
| W3 | One vocabulary for all audiences. The per-door taxonomy of §21.3 is retired from the UI; "Places" becomes "Sellers"; a people-surface denylist joins `pnpm verify`. | §22.3 |
| W4 | Positioning and copy: "Give a budget. Not your wallet."; the GrantSummary sentence; leftovers are *taken back*, never "returned automatically"; a risk strip everywhere. | §22.4 |
| W5 | Release slice R1 is the whole next release; everything else is backlog. | §22.5 |
| W6 | Flagged ideas decided: permit, rotating codes and kill switch rejected; 7702, embedded wallets and notifications deferred; WalletConnect, SDK error codes and MCP URL elicitation approved (additive). | §22.6 |

**What to do now:** fix A1–A5 with regression tests first, then R1 in the §22.9 order. Log decisions as D42 onward.

---

# Spec change notice: v1.4.1 → v1.5 (24 Sep 2026)

**For the implementing agent.** `docs/BUILD_SPEC.md` has been updated to **v1.5**. Everything new is in **§21** (normative), and §21 wins where it conflicts with earlier sections.

**Unchanged:** the protocol (§6), the contract (§7), invariants I1–I7, C1 and S1–S4, and decisions D1–D22.

## What changed

| # | Change | Section |
|---|---|---|
| V1 | Delete `.github/workflows`. Add a local `pnpm verify` gate that covers lint, typecheck, unit/property/store tests (S4 also against Upstash when env is set), forge tests + invariants, a secret scan, the public-surface denylist check, and optional e2e. Keep making local commits per phase; never push. | §21.1 |
| V2 | Remove `/hackathons/[event]`, `lib/hackathons.ts` and every public event name. Add `/chains/[chain]` pages with `?chain=` preselection. Event materials move to `docs/submissions/` (not deployed). Add the denylist build check. | §21.2 |
| V3 | Taxonomy per door: Giver/Holder/Place vs Owner/Agent/Service. Counting House tabs: Give · Holders · Places · Requests · Collect. 402 `hint` body plus structured agent errors. | §21.3 |
| V4 | Spending requests: the `SpendRequest` / `RequestGrant` / `TabOffer` EIP-712 objects (domain `FlyingMoneyRequest`), a no-server link channel, a relay on Upstash with an owner session and decisions verified on-chain, the Requests tab, `fm.requestBudget`, and MCP tools `fm_request_budget` + `fm_request_status`. Invariants R1–R5. | §21.4 |
| V5 | Final database: Upstash via the Vercel Marketplace. Read `KV_REST_API_URL`/`KV_REST_API_TOKEN` first, then fall back to `UPSTASH_REDIS_REST_*`. Two databases (testnet / mainnet), `FM_ENV`, `FM_REDIS_PREFIX`, `CRON_SECRET`, the key schema, and refusal to start without a durable store. | §21.5 |
| V6 | The hosted Oracle as its own Vercel project. The redeemer runs opportunistically (`waitUntil`) + via cron (daily on Hobby) + via the manual Collect. **On Hobby: `safetyBeforeExpiry ≥ 36 h` and seller-facing certificate lifetimes ≥ 3 days.** | §21.6 |

**Order:** V1 + V2 now → V5 + V6 before 3 Oct → V4 + V3 polish in Sprint B (§21.7).

**Alignment with your current plan:** your four-item plan matches this. Two refinements from the spec:
1. Read the Vercel-injected `KV_REST_API_*` variables, not only `UPSTASH_REDIS_REST_*`.
2. Apply the Hobby-cron safety margin.

**What to do now:**
1. Re-read §21.
2. Log any implementation choices as new D-numbers in `docs/DECISIONS.md`.
3. Report conflicts before building.
