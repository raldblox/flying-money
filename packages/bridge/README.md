# Flying Money x402 bridge (beta)

A service that lets an agent pay **ordinary x402 sites** from a capped Flying Money budget. The agent holds no money and pays
no gas; the budget is the cap. Private package (not on npm), Base mainnet beta plus test networks, **not audited**.

- Overview: [docs/site/x402.md](../../docs/site/x402.md) · Setup, costs, fees, security model: [docs/site/bridge.md](../../docs/site/bridge.md)
- It is a normal Flying Money seller whose product is "an x402 call": it reads the site's own 402, quotes the price plus its
  fee, and pays the site from its own wallet; collecting the budget refills that wallet.

## Run it

```bash
# local, one process (durable files)
BRIDGE_FLOAT_KEY=0x… BRIDGE_CHAINS=base-sepolia BRIDGE_DEV=1 pnpm --filter @flying-money/bridge start
pnpm --filter @flying-money/bridge test        # offline tests
pnpm --filter @flying-money/bridge spike       # live Base Sepolia run (needs DEMO_FUNDER_KEY with test USDC)
```

The hosted beta is `apps/bridge` (Vercel, Upstash Redis, daily collection cron): <https://flying-money-bridge.vercel.app>.

## Operator runbook (hosted beta)

| Task | How |
|---|---|
| See its health | `GET /status`, or `/bridge?url=https://flying-money-bridge.vercel.app` in the app: balance, `liquidity.health` (`ok`, `low`, `empty`), owed, fees earned, collection gas |
| Top up | Send USDC (to pay sites) and a little ETH (to collect) to the bridge wallet; keep the balance small |
| Collect now | `GET /api/cron/collect?force=1` with `Authorization: Bearer $CRON_SECRET`. Without `force=1` it follows the policy (1 USDC owed, 20 hours old, or a budget within 36 hours of ending) |
| Rotate the cron secret | `vercel env rm CRON_SECRET production`, add a new one, redeploy |
| Change fees or limits | Vercel env: `BRIDGE_FEE_BPS`, `BRIDGE_FEE_FLAT`, `BRIDGE_MAX_UPSTREAM`; redeploy. The schedule is public on `/status` |
| Keys | The wallet key lives only in the sensitive `BRIDGE_FLOAT_KEY` variable and in an offline backup; never in the repo. Prefer a separate gas-only `BRIDGE_REDEEMER_KEY` |
| RPC trouble | Defaults use two public RPCs with fallback. For production load, set `RPC_BASE_MAINNET` to a keyed endpoint (comma-separate a fallback) |
| Stop it | Remove `BRIDGE_FLOAT_KEY` (it then answers 503), or pause the project; budgets stay safe in the contract and return to their owners after the end date |

Agents use it with `FM_BRIDGE_URL` in the MCP server (`fm_quote`, `fm_paid_fetch`, `fm_request_budget`) or by reading `/skill.md`.
