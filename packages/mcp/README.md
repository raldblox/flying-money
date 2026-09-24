# MCP server (`@flying-money/mcp`)

Docs: https://useflyingmoney.vercel.app/docs/mcp · Spec: `docs/BUILD_SPEC.md` §8.4

An MCP server that lets any MCP-capable agent (Claude Desktop or Claude Code, Hermes-based agents, and others) pay Flying Money APIs with its certificate. The budget is enforced by the certificate, not by the prompt.

## Tools

| Tool | Input | Output |
|---|---|---|
| `fm_status` | none | Your certificates: chain, payee, face value, spent, remaining, expiry (read-only) |
| `fm_explain` | none | Plain-language rules: who you can pay, how much, until when |
| `fm_quote` | `url` | The price and accepted chains, without paying |
| `fm_paid_fetch` | `url`, `method?`, `body?`, `max_price?` | The response body and the payment (price, running total, remaining). Refuses prices above `max_price` or the per-request cap |

There is **no tool to issue or top up a certificate**, and no tool returns the spending key. Issuing is the funder's job in the Counting House, so an agent can never raise its own budget.

## Configuration (environment)

| Variable | |
|---|---|
| `AGENT_KEY` | The agent's spending key. Make it with `npx @flying-money/client keygen --out .env`. It holds no money |
| `AGENT_CERTIFICATES` | Certificate ids issued to that key, comma-separated |
| `AGENT_CHAINS` | Registry keys, comma-separated (default `arbitrum-sepolia`) |
| `FM_MAX_PRICE` | Per-request cap in USDC (default `0.05`) |
| `FM_STORE` | Durable outbox file (default `~/.flying-money/outbox.json`) |

The package is not on npm yet. Build it from the repository (`pnpm install && pnpm build`) and point your client at `packages/mcp/dist/bin.js`.

## Claude Desktop

In `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "flying-money": {
      "command": "node",
      "args": ["/path/to/flying-money/packages/mcp/dist/bin.js"],
      "env": {
        "AGENT_KEY": "0x…",
        "AGENT_CERTIFICATES": "0x…",
        "AGENT_CHAINS": "arbitrum-sepolia",
        "FM_MAX_PRICE": "0.05"
      }
    }
  }
}
```

## Claude Code

```bash
claude mcp add flying-money -e AGENT_KEY=0x… -e AGENT_CERTIFICATES=0x… -- node /path/to/flying-money/packages/mcp/dist/bin.js
```

## Any MCP client over HTTP

```bash
node packages/mcp/dist/bin.js --http 8788   # streamable HTTP at http://127.0.0.1:8788/mcp (localhost only)
```

## Notes

- The key sits in your MCP client's config in plain text. That is acceptable only because a spending key holds no money: at worst it can spend what is left on its certificates, and only at those sellers.
- `max_price` is checked against the seller's quoted price before paying. The per-request cap (`FM_MAX_PRICE`) and the certificate's face value always apply.
- Failed requests are not charged: the seller turns the price into credit for your next request.
