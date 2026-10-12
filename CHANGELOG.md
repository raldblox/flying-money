# Changelog

All notable changes to Flying Money. The contract has no version: each deployment is immutable; packages follow semver.

## Unreleased

### Added
- **Base mainnet deployment** (`0x25C12e1B9106Ef64fA5849b3910ceebBf8cB7EF9`, chain 8453): immutable caps of 1,000 USDC per budget and 10,000 USDC in total. Source verified on Sourcify. Arc mainnet stays at 100 / 1,000.
- **x402 bridge** (`packages/bridge`, `apps/bridge`): agents pay ordinary x402 sites from a capped budget; self-hosted or the hosted beta at `flying-money-bridge.vercel.app`. Public `/status`, a `/bridge` page that checks the chain, fees, batch-friendly collection, a daily cron.
- **Agent skills** (`skills/`): `flying-money`, `flying-money-x402`, `flying-money-owner`, installable with `npx skills add`, served at `/skill.md` and `/.well-known/skills/`.
- **Networks hub** (`/networks`, `/mainnet`, `/testnet`), a money-path panel on every budget, real-money confirmations on mainnet approvals and top-ups, and warnings in the MCP tools.
- Open Graph / Twitter cards, canonical URLs, structured data, `robots.txt`, `sitemap.xml`, terms, privacy and security pages, `security.txt`.
- Several RPCs per network with a fallback transport.

### Changed
- MCP: `fm_quote` and `fm_paid_fetch` fall back to the owner's bridge for ordinary x402 sites (`FM_BRIDGE_URL`).

## 0.1.0

First public packages on npm: `@flying-money/core`, `client`, `server`, `mcp`, `chains`, `abi`.
