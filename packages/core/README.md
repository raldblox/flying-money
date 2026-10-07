# @flying-money/core

The Flying Money protocol: budget and payment-slip types, EIP-712 signing and verification, the `fm1` wire format, and the x402 V2 `flying-money` scheme.

Part of [Flying Money](https://github.com/raldblox/flying-money): give an AI agent or a person a budget, not your wallet. A budget is USDC locked for one
seller, one spending key, a maximum and an end date. Live on test networks and, under immutable caps, on Arc mainnet; not audited.

## Install

```bash
npm install @flying-money/core
```

## Example

```ts
import { signNote, verifyNoteSignature } from '@flying-money/core'
```

Docs: https://useflyingmoney.vercel.app/docs/protocol · Source: https://github.com/raldblox/flying-money

MIT licence.
