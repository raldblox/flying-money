---
title: Glossary
description: One vocabulary: the words people see, the words agents see, and the names in the code.
---

# Glossary

Flying Money uses one set of words everywhere. People-facing screens, agent tools and the code sometimes name the same thing differently; this table says which words mean the same object. AI agents reading these docs: "budget" and "certificate" are the same thing.

| People see | Agents see | Code | What it means |
|---|---|---|---|
| Budget | budget | certificate | Money earmarked in a public contract for a seller, a user and an end date: as good as paid to that seller, useless to anyone else. |
| Funded by | owner | funder | Who put the money in. |
| Can use | agent (spending key) | spender | The key that can sign payment slips. |
| Pays / Seller | service | payee | The only address that can ever be paid from it. |
| Payment slip | slip | note | A signed "total so far" for one budget. The seller checks it in milliseconds; no transaction. |
| Payment code | — | note (as a QR) | A payment slip shown as a QR code on the holder's phone at a counter. |
| Collect | collect | redeem | The seller sends slips to the contract and receives what was spent, in one transaction. |
| Take back what's left | reclaim | reclaim | After the end date, the funder takes the unspent money back with one transaction. It is not automatic. |
| Network fee | gas | gas | What the blockchain charges for a transaction, paid by whoever sends it. |

## Budget status

| Status | Meaning |
|---|---|
| Active | It can be used. |
| Ending soon | It ends within 3 days. |
| Ended | The end date passed. The seller can no longer be paid from it; the funder can take back what's left. |
| Closed | What was left has been taken back. |

## What a budget can't do

- It can't be cancelled early, and its user or seller can't be changed. It can be topped up or extended.
- It never pays anyone but its one seller, and never more than its amount.
- Money left at the end date stays in the contract until the funder takes it back.
