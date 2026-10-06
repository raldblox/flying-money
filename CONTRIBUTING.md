# Contributing to Flying Money

Thanks for your interest. Flying Money is open source (MIT): a contract, a TypeScript SDK, an MCP server and a web app
for prepaid, capped USDC budgets. It runs on test networks and is **not audited**, so please don't use it with real
money.

## Ways to help
- **Try it and report what's confusing.** The [live site](https://useflyingmoney.vercel.app/start) has guided paths for
  giving a budget, connecting an AI assistant, using a budget and running a shop till. Open an issue with what you
  expected and what happened.
- **Build a seller or an agent** with the SDK ([sellers](docs/site/server.md), [buyers](docs/site/client.md),
  [MCP](docs/site/mcp.md)) and tell us where the docs fell short.
- **Review the security model.** Read [docs/SECURITY.md](docs/SECURITY.md). Report vulnerabilities privately, as
  described there, never in a public issue.
- **Fix a bug or improve a doc.** Small, focused pull requests are easiest to review.

## Setup
Requires Node 22+, pnpm 10 (`corepack enable`) and, for the contracts, [Foundry](https://book.getfoundry.sh/).

```bash
git clone https://github.com/raldblox/flying-money && cd flying-money
git submodule update --init --recursive   # contract dependencies
pnpm install
pnpm dev        # the site, the demo seller, and the packages rebuilt as you edit (Ctrl+C stops all)
```

`pnpm dev:https` serves the site over HTTPS with a self-signed certificate, which a phone needs for the camera and
microphone (QR and sound). Flags: `--no-oracle`, `--no-watch`, `--port <n>` (`pnpm dev -- --no-oracle`).

Copy `.env.example` to `.env` only if you need RPC overrides, a seller store or the demo runner. Nothing needs a key to
build or test; local end-to-end tests use a private anvil chain.

## Before you open a pull request
1. Run **`pnpm verify`** (lint, clean build, typecheck, all tests, secret scan, public-surface checks). Run
   `pnpm verify --e2e` too if you changed the web app.
2. Add or update tests with the change. For anything touching payments, write the failing test first.
3. Keep amounts as integer base units (`bigint`), and chain values in `packages/chains` only.
4. Describe *why* in the pull request, and link the issue it closes.

The rules that protect users (the contract and seller invariants, ECDSA-only spenders, no admin keys) are listed in
[AGENTS.md](AGENTS.md). Changes that weaken them won't be merged; if you think one is wrong, open an issue to discuss it.

## Code style
[Biome](https://biomejs.dev/) formats and lints (`pnpm lint`). TypeScript is strict ESM; Solidity follows the existing
contract. Match the surrounding code: its naming, its comment density, and its plain-language user-facing copy (the
app's words are listed in the [glossary](docs/site/glossary.md)).

## Conduct
Everyone taking part follows the [Code of Conduct](CODE_OF_CONDUCT.md).
