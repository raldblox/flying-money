# MCP server (`@flying-money/mcp`)

Docs: https://useflyingmoney.vercel.app/agent.md · Reference: [docs/site/mcp.md](../../docs/site/mcp.md)

An MCP server that lets any MCP-capable agent (Claude Desktop or Claude Code, Hermes-based agents, and others) pay APIs from a budget its owner gives it, and ask its owner for one. The budget's limits are enforced on-chain, not by the prompt.

## Start it with one setting

The only setting you need is your owner's wallet address:

```bash
claude mcp add flying-money -e FM_OWNER=0xYourWallet -- npx -y @flying-money/mcp
```

On first run the server makes its own spending key and keeps it in `~/.flying-money/agent-key` (readable only by you). It never prints or returns the key. A spending key holds no money: it can only spend budgets its owner funds, and only at the seller each one names. Call `fm_status` to see your spending address.

Check the setup without restarting your MCP client: `--check` starts the server in-process, lists its tools, prints `fm_status` as JSON and exits.

```bash
FM_OWNER=0xYourWallet npx -y @flying-money/mcp --check
```

To try a real paid API, `fm_quote` the live demo seller: `https://flying-money-oracle.vercel.app/v1/tea-price?city=Luoyang` (0.01 test USDC per call).

Then, when a paid service needs a budget, `fm_request_budget` sends your owner a request (or gives you a link for them). The owner approves it in the app. Nobody copies keys or ids by hand.

## Tools

| Tool | Input | Output |
|---|---|---|
| `fm_status` | none | Your spending address and budgets: network, seller, amount, spent, remaining, end date (read-only) |
| `fm_explain` | none | Plain-language rules: who you can pay, how much, until when |
| `fm_quote` | `url` | The price and accepted networks, without paying |
| `fm_paid_fetch` | `url`, `method?`, `body?`, `max_price?` | The response and the payment. Refuses prices above `max_price` or the per-request cap |
| `fm_request_budget` | service, amount, days, reason | Asks your owner for a budget; moves no money |
| `fm_request_status` | `requestId` | Whether your owner approved it |

There is **no tool to give or top up a budget**, and no tool returns the spending key. Only the owner can fund one, from their own wallet.

## Settings (environment)

| Variable | |
|---|---|
| `FM_OWNER` | Your owner's wallet address, so you can ask them for budgets. Can be added later: without it the server still starts, and `fm_status` says what to ask your owner for |
| `FM_OWNER_GRANT` | Optional: the owner's permission to send requests straight to their inbox (from People & agents in the app) |
| `AGENT_KEY` | Optional: bring your own spending key instead of the one the server makes |
| `FM_KEY_FILE` | Where the made key is kept (default `agent-key` next to `FM_STORE`) |
| `AGENT_CERTIFICATES` | Optional: budget ids already given to you, comma-separated |
| `AGENT_CHAINS` | Registry keys, comma-separated (default: every test network the contract is deployed on: `arbitrum-sepolia,base-sepolia,ethereum-sepolia,tempo-testnet`) |
| `FM_MAX_PRICE` | Per-request cap in USDC (default `0.05`) |
| `FM_STORE` | Durable outbox file (default `~/.flying-money/outbox.json`) |

Prefer to build from source? Run `pnpm install && pnpm build` in the repository and use `node /path/to/flying-money/packages/mcp/dist/bin.js` in place of `npx -y @flying-money/mcp`.

## Claude Desktop

In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "flying-money": {
      "command": "npx",
      "args": ["-y", "@flying-money/mcp"],
      "env": { "FM_OWNER": "0xYourWallet" }
    }
  }
}
```

## No MCP client? One-shot commands

Every tool also runs as a one-shot command that prints its result on stdout (the exit code is 1 when the tool reports an error). Any language can call it as a subprocess; the key, the payment log and approved budgets persist between calls. See [Agents](https://useflyingmoney.vercel.app/docs/agents) for a Python example.

```bash
FM_OWNER=0xYourWallet npx -y @flying-money/mcp call fm_quote '{"url":"https://flying-money-oracle.vercel.app/v1/tea-price?city=Luoyang"}'
```

`npx -y @flying-money/mcp --help` lists the tools and their inputs.

## Any MCP client over HTTP

```bash
npx -y @flying-money/mcp --http 8788
```

This serves streamable HTTP at `http://127.0.0.1:8788/mcp`, for this machine only.

## Notes

- `max_price` is checked against the seller's quoted price before paying. The per-request cap (`FM_MAX_PRICE`) and the budget's amount always apply.
- Failed requests are not charged: the seller turns the price into credit for your next request.
