# @flying-money/chains

The network registry for Flying Money: chain IDs, RPCs, stablecoin addresses, explorers and deployed contract addresses for every supported test network (Arbitrum, Base, Ethereum and Tempo testnets).

Part of [Flying Money](https://github.com/raldblox/flying-money): give an AI agent or a person a budget, not your wallet. A budget is USDC locked for one
seller, one spending key, a maximum and an end date. Live on test networks and, under immutable caps, on Arc mainnet; not audited.

## Install

```bash
npm install @flying-money/chains
```

## Example

```ts
import { getChain } from '@flying-money/chains'

const c = getChain('base-sepolia')
console.log(c.flyingMoney, c.usdc)
```

Docs: https://useflyingmoney.vercel.app/docs/contract · Source: https://github.com/raldblox/flying-money

MIT licence.
