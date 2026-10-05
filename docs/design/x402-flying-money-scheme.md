# Scheme: `flying-money` (x402 V2)

**Status:** prototype, implemented in `@flying-money/core`, `@flying-money/server` (opt-in `x402: true`) and
`@flying-money/client`. Live on the hosted demo seller. Not registered with the x402 project.

## Summary

`flying-money` is an x402 scheme for **prepaid, capped budgets**. A funder locks USDC in the FlyingMoney contract for
**one seller, one spending key, a maximum and an end date** (a *certificate*). The buyer pays each request with an
EIP-712 **note** signed over the running total for that certificate. The seller verifies the note locally, serves the
request, and later collects the highest note on-chain in one transaction (`redeem` or `redeemMany`).

Compared with other escrow-and-voucher schemes, the defining property is that **the payer can't cancel early**: until
the certificate's end date, funds can leave only to its seller. A seller that has verified a certificate can serve
without watching the chain for withdrawals, including while its own chain connection is down. The cost is liquidity
for the payer, who takes back the remainder after the end date.

This scheme is a transport mapping only: the offer, note, receipt and contract are exactly Flying Money's own
([protocol](../site/protocol.md), [contract](../site/contract.md)). A seller accepting it runs the unmodified seller
algorithm, so its guarantees (idempotency per request, reservations, replay refusal) are unchanged.

## Use Cases

- AI agents paying per request for APIs, data and inference, from a budget their owner funded and can't exceed.
- Many small purchases at one seller without a transaction each; collection is batched.
- Shops and services that must keep accepting already-verified budgets during a connectivity outage.

## `PaymentRequirements`

One `accepts` entry per supported chain. All `flying-money` entries in one `PaymentRequired` share one price and one
set of terms.

```json
{
  "scheme": "flying-money",
  "network": "eip155:421614",
  "amount": "10000",
  "asset": "0x…USDC on this chain (from the registry)",
  "payTo": "0x…seller",
  "maxTimeoutSeconds": 300,
  "extra": {
    "contract": "0x…FlyingMoney on this chain",
    "minRemainingLifetime": 3600,
    "suggestedFaceValue": "500000"
  }
}
```

| Field | Meaning |
|---|---|
| `network` | CAIP-2 `eip155:<chainId>` |
| `amount` | price of this request in token base units |
| `asset` | the USDC token the certificate holds |
| `payTo` | the seller: the certificate's immutable payee |
| `extra.contract` | the FlyingMoney contract on that chain (EIP-712 `verifyingContract`) |
| `extra.minRemainingLifetime` | seconds the certificate must still have before its end date |
| `extra.suggestedFaceValue` | optional: a sensible budget to ask the owner for |
| `extra.memoHint`, `extra.docs` | optional, as in the Flying Money offer |

## `PaymentPayload.payload`

The signed note, as its Flying Money JSON form (decimal strings for integers):

```json
{
  "v": 1,
  "chainId": "421614",
  "contract": "0xb9ae…67F2",
  "certificateId": "0x…32 bytes",
  "cumulative": "30000",
  "memo": "0x…32-byte requestId",
  "sig": "0x…65 bytes"
}
```

`accepted` MUST be the entry for the note's own `chainId` and `contract`. The note signs
`Note(bytes32 certificateId, uint256 cumulative, bytes32 memo)` under the domain `FlyingMoney`, version `1`,
that `chainId` and `contract`, with a low-s ECDSA signature from the certificate's spender.

**Client rules.** `cumulative = max(accepted, consumed + reserved + price)` from the client's own state, never more
than the certificate's face value. `memo` is a fresh request id. The note is saved durably **before** sending. After a
timeout or a lost response, the client resends the **same** payload, byte for byte; it never signs a higher one
because of a failure.

## Verification and settlement

Payment flow: `authorization` (the default). The seller (or a facilitator acting for it) verifies, runs the resource,
then records the outcome:

1. Decode the note; check `accepted` matches its chain and contract; recover the signer (low-s ECDSA only).
2. Read the certificate on-chain (or from a cache verified earlier): payee is this seller, the signer is its spender,
   it is open, and it has at least `minRemainingLifetime` left.
3. Admit atomically: `cumulative ≤ faceValue` and `cumulative ≥ consumed + reserved + price`; reserve the price. A
   request id seen before returns its stored outcome instead of running again.
4. Run the resource. On success, record it as served; on failure, the price becomes credit for the next request.

There is **no transaction per request**. The settlement response therefore has an empty `transaction`, as the core
specification allows. The seller collects later with `redeem(note)` or `redeemMany(notes)`; the contract pays
`cumulative − redeemed` to the payee and never more than the face value.

`PAYMENT-RESPONSE` carries the seller's receipt in an extension, so an x402-only seller still returns the state the
client needs:

```json
{
  "success": true,
  "transaction": "",
  "network": "eip155:421614",
  "payer": "0x…spender",
  "extensions": {
    "flying-money-receipt": { "info": { "receipt": "fm1.…" }, "schema": { "type": "object" } }
  }
}
```

A failed service reports `success: false` with `errorReason: "service_failed_credited"`; nothing is owed for it. The
client trusts a receipt only up to what it signed itself.

## Security considerations

- **Bounded loss.** A stolen spending key can spend at most the certificate's remainder, and only at its payee.
- **Replay.** A note's `memo` binds it to one request; the seller refuses it for any other request.
- **No early cancel.** The funder can reclaim only after the end date. Sellers must collect before then.
- **Transport equivalence.** A seller accepting both `Flying-Money-Note` and `PAYMENT-SIGNATURE` refuses a request
  carrying both.
- The contract is unaudited and runs on testnets.

## Appendix

- Reference implementation: `x402PaymentRequired`, `x402OfferFromRequired`, `x402PaymentPayload`,
  `x402NoteFromPayload`, `x402SettlementResponse` and `x402ReceiptFromResponse` in `packages/core/src/index.ts`;
  tests in `packages/core/test/x402.test.ts`, `packages/server/test/x402.test.ts`, `packages/client/test/x402.test.ts`.
- Comparison with x402 `batch-settlement` and MPP sessions: [compatibility-x402-mpp.md](compatibility-x402-mpp.md).
