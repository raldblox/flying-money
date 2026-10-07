# Security: guarantees, threat model, test evidence

## Reporting a vulnerability

Please **don't open a public issue** for a security problem. Report it privately through GitHub: **Security → Report a vulnerability** on this repository. If that isn't available, open an issue titled "Security contact request" with no details, and a maintainer will reply with a private channel. We aim to acknowledge reports within 3 days. This is a testnet project without a bug bounty; please don't test against other people's funds or budgets.

> **Audit status: not audited.** Invariant- and property-tested. Live on the Arbitrum, Base, Ethereum and Tempo test
> networks, and on **Arc mainnet** (chain 5042) under immutable launch caps: 100 USDC per budget, 1,000 USDC in total. The caps are set in the
> contract's constructor, so no one can raise them; only a new deployment can supersede them.

## What is guaranteed (and nothing stronger)

1. Every **redeemable** note is backed by funds reserved exclusively for its payee until the certificate expires.
2. The spender cannot authorize more than the certificate's face value.
3. Anyone can redeem a redeemable note, but its value can only be delivered to the certificate's payee.

| Party | Guarantee | Conditions |
|---|---|---|
| Payee | Every redeemable note is backed by funds reserved exclusively for it; redeeming a redeemable note pays exactly `cumulative − redeemed` | Redeems before `expiresAt`; token not frozen; chain live; its acceptance state is authoritative |
| Funder | Spending is bounded by `faceValue`; can reclaim the remainder after expiry | Successful on-chain reclaim; chain live; token not frozen; gas required |
| Funder (spender key stolen) | Loss ≤ remaining face value of certificates bound to that key | — |
| Spender | Cannot be charged more than the highest cumulative it signed; retries never create extra charges; network failures never raise its obligation | Signatures over cumulative totals; `requestId` idempotency; durable outbox |
| Everyone | Funds go only to the payee named at issuance | — |

**Not guaranteed:** that the payee delivers the service; that notes reach the payee.

**Honest limits:** payment ≠ service (no chargebacks); the payee must redeem before expiry; the stablecoin issuer
can freeze funds; chain liveness is assumed at redemption; a payee running several servers must share its store.

## Threat model

| Threat | Outcome | Why |
|---|---|---|
| Agent (spender) key stolen | Attacker can pay **only the named payee**, up to the remaining face value | Payee-scoped + cap |
| Agent goes rogue or loops | Spending stops at the face value; the client also enforces `maxPricePerRequest` | Cap on-chain and in the client |
| Payee tries to overcharge | Impossible beyond notes the spender signed | Cumulative totals signed by the spender |
| Payee serves nothing | Funder loses up to what the agent signed | Payment ≠ service; bounded by face value |
| Funder tries to pull funds early | Not possible | No cancel; reclaim only after expiry |
| Very short expiry | Rejected below 1 h by the contract; servers require `minRemainingLifetime` | Contract `issue`; [seller check](site/protocol.md) |
| Replay on another chain/contract | Invalid | EIP-712 domain |
| Signature malleability | Rejected | OZ ECDSA low-s |
| Front-running a redeem | Harmless | Funds always go to the payee |
| Payee runs 2 servers without a shared store | The payee may serve more than it can redeem (its own loss) | The store must be shared |
| Payee misses expiry | Payee loses unredeemed value | Redeemer safety margin + alerts |
| Hostile/unusual token behaviour | Out of the attack surface | One immutable token per deployment (Circle USDC); balance-delta check as defence in depth |
| ERC-1271 / contract-signature revocation | Not applicable | ECDSA-only spenders; validity never depends on chain state |
| Buyer retries after a timeout | No double charge, no duplicate side effect | `requestId` idempotency (S1) |
| Buyer crashes mid-request | No higher note is ever signed; the pending note is resent | Durable outbox (C1) |
| Seller crashes after accepting, before serving | Buyer's retry resumes it; otherwise the sweeper resolves it (done → served; not started → credit) | [Seller algorithm](site/protocol.md): resume and sweeper |
| Adversarial spender sends many concurrent requests reusing the same credit | Only as many are admitted as `accepted − consumed − reserved` allows | `reserved` + atomic re-check in `begin` (S4) |
| Funder uses its own wallet as the spender, or payee = spender | Rejected by the contract | Structural key isolation in `issue` |
| Unaudited contract bug | Test networks hold test money; on Arc mainnet at most 1,000 USDC is ever exposed | Immutable launch caps on mainnet (`maxFaceValue` 100 USDC, `maxTotalOutstanding` 1,000 USDC); no further mainnets until an independent audit |
| Stablecoin freeze or blocklist | Funds stuck; a redeem to a blocklisted payee reverts | Inherent to the token; disclosed |
| RPC lies to the server | Server may accept notes against a fake certificate | Use a trusted RPC; disclosed |
| Customer's phone stolen | Thief can spend only at the named shop(s), up to the remaining face value | Payee-scoped + cap; PIN-encrypted key; keep face values small |
| Multi-POS shop offline, unsynced | The same range may be accepted twice across devices (the shop's own loss) | Primary-POS rule or per-device float |
| Gift link leaked | Whoever holds it can spend it (at that shop only) | Treat like cash |
| First-time customer while POS offline | Fabricated certificate possible | Shown as **UNVERIFIED · merchant risk**, capped by the first-visit limit |
| Agent tries to raise its own budget via MCP | Not possible | No issue/topUp tools; the agent key isn't the funder |
| Seller store wiped | A note at or below on-chain `redeemed` never counts as new value; served-but-unredeemed history is lost | `RECOVERED` state; the seller bears ≤ its redemption lag; the buyer never loses credit |
| Chain analysis | Flows, amounts, times and random spender addresses are public; names are not | Fresh keys for people; names never on-chain |
| Fake shop in Places | A funder could lock money for a scammer | Places added by in-person QR scan or the seller's own-domain `/.well-known/flying-money.json`; typed addresses labelled unverified |

**Out of scope:** paying strangers offline; strong privacy; freezing a certificate early (by design); disputes and refunds.

## Contract test evidence (`contracts/`)

Toolchain: solc 0.8.24, OpenZeppelin 5.1.0, `evm_version = shanghai`, optimizer 200 runs.
`contracts/src/FlyingMoney.sol` is the reference implementation of the [contract specification](site/contract.md).

**Unit tests (`test/FlyingMoney.t.sol`): 25 pass** (24 FlyingMoney, 1 MockUSDC). Coverage:

- **Issue (#1, #2, #4c, #4d):** fields, exact pull, nonce and id derivation; parameter and lifetime bounds; the fee-on-transfer fixture (`UnsupportedToken`); `payee == contract`; `spender == funder` or `payee`.
- **Redeem (#3, #4, #4b, #5–#8):**
  - a stranger's redeem pays the payee;
  - `NothingToRedeem`, and skip reason 5;
  - a mixed batch skips with reasons `[1,2,3,4,6,5]` and never reverts;
  - over face value;
  - wrong signer (funder, payee, random), high-s, and another chain or contract are all rejected.
- **ECDSA-only permanence (#9):** tested with `vm.etch` on an ERC-1271 contract that accepts garbage.
- **Lifecycle (#10, #11):** expiry, reclaim and closed boundaries; topUp and extend rules.
- **Reentrancy (#12):** re-entry through redeem, redeemMany and reclaim is blocked.
- **Gas (#13).**
- **Caps (#14, #14b):**
  - per-certificate and deployment-wide caps on both issue and topUp;
  - 0 means unlimited;
  - `totalOutstanding` goes down on redeem and reclaim;
  - the constructor rejects a token with no code, and there is no token parameter.

**Invariant tests (`test/FlyingMoney.invariants.t.sol`): 16 pass, 256 runs × depth 50 (12,800 calls each)**.
They run against an uncapped deployment and a capped one (300 / 1,000 USDC). The handler issues, tops up, extends, signs, and redeems notes that are duplicated, older, over face value or forged, from the payee or a stranger. It also runs `redeemMany` over mixed batches, warps time and reclaims. An instrumented token records every transfer, so I3–I6 are checked against real token movements, not the contract's return values.

| Invariant | Statement |
|---|---|
| I1 | `redeemed ≤ faceValue` for every certificate |
| I2 | `balanceOf(contract) == totalOutstanding == Σ open (faceValue − redeemed)` |
| I2b | `totalOutstanding ≤ maxTotalOutstanding` (and `faceValue ≤ maxFaceValue`) when capped |
| I3 | Each payee's received total == Σ over its certificates of the highest redeemed cumulative |
| I4 | Funder outflow ≤ face value issued; refunds ≤ deposits |
| I5 | Every transfer out goes to that certificate's payee (redeem) or funder (reclaim) |
| I6 | No transfers for a certificate after it is reclaimed |
| I7 | `redeemed` never decreases; payout == highest redeemed cumulative |

## Gas

Measured with `pnpm --filter @flying-money/contracts gas` (`forge test --isolate --gas-report`). Each call runs as its own transaction with cold storage, and the figures include the 21,000 base cost.

| Call | Gas |
|---|---|
| `redeem` (one note) | **85,758** |
| `redeemMany` (10 notes, 10 certificates) | **328,192** (≈ 32,800 per note) |
| `issue` | 170,723 (typical) |
