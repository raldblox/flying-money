---
name: flying-money-owner
description: "For the person who funds an AI agent with Flying Money budgets: approve or decline an agent's budget request, check where the money is, take back what's unspent, and run or check an x402 bridge. Use when helping an owner (not the agent) with budgets."
---

# Flying Money for owners

You (the owner) give an agent **spending power without giving it your wallet**. A budget is money set aside from your
wallet for **one seller**, spendable only by the agent's key, up to an amount, until an end date.

## Approve a request

1. The agent gives you a link (or it appears under **Requests** in the app: https://useflyingmoney.vercel.app/app/requests).
2. Read it: **who** asks, **which seller** can be paid, **how much**, **for how long**. The reason text is written by the
   agent and is unverified.
3. On a mainnet it is **real USDC**: tick the real-money box, approve a **small** amount, and approve only requests you
   asked for. You can approve a smaller amount than asked.
4. Approve with your own wallet in the app. The agent can never approve for you.

## See where the money is

Account → **Budgets** → open a budget → **Where this money is**: funded, locked in the contract, paid to the seller,
returned to you. Money the agent has signed but the seller hasn't collected yet isn't visible on-chain.

## Take back what's unspent

After a budget's end date, **Budgets** shows "ready to take back". Only your wallet can. It can't be cancelled early.

## Pick a network

https://useflyingmoney.vercel.app/networks lists mainnets (real money, capped, not audited) apart from test networks.

## Run or check an x402 bridge

A bridge lets your agent pay ordinary x402 sites. Check any bridge at https://useflyingmoney.vercel.app/bridge (enter its
address): wallet balance and health, what it has paid and collected, fees earned, and the numbers checked against the
chain. To run your own: https://useflyingmoney.vercel.app/docs/bridge (costs, fees, collection, security model).
Keep only a small balance in the bridge wallet, keep its key out of the repo, and collect before budgets end.

Docs: https://useflyingmoney.vercel.app/llms.txt
