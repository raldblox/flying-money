# Flying Money x402 bridge (prototype)

A self-hosted service that lets an agent pay **ordinary x402 sites** from a capped Flying Money budget. The agent holds no
money and pays no gas; the budget is the cap. Private package (not on npm yet), test networks only, not audited.

- Overview: [docs/site/x402.md](../../docs/site/x402.md) · Setup and settings: [docs/site/bridge.md](../../docs/site/bridge.md)
- Design and results: the bridge is a normal Flying Money seller whose product is "an x402 call". It reads the site's own
  402, quotes its price as a Flying Money offer, and pays the site from its float; collecting the budget refills the float.

```bash
# from a checkout of the repo
pnpm install
BRIDGE_FLOAT_KEY=0x… BRIDGE_CHAINS=base-sepolia BRIDGE_DEV=1 pnpm --filter @flying-money/bridge start
pnpm --filter @flying-money/bridge test        # offline tests
pnpm --filter @flying-money/bridge spike       # live Base Sepolia run (needs DEMO_FUNDER_KEY with test USDC)
```

Agents use it with `FM_BRIDGE_URL` in the MCP server (`fm_quote`, `fm_paid_fetch`, `fm_request_budget`).
