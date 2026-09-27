# Pilot plan (BUILD_SPEC §22.7 · testnet only · no real money)

**28 Sep 2026.** Two small pilots, each with its participants, baseline and success threshold agreed **before** it starts (P14, §22.8). Safety failures stop a pilot; convenience numbers can't make up for them. A real-money pilot needs §0.1 approval, an audit, and legal and partner review.

## Pilot 1: an assistant pays a useful repeat service

- **Seller:** one genuinely useful paid API the founder names (**input needed**). The Silk Road Oracle is a demo and doesn't count.
- **Participants:** 3 people who use an AI assistant for real tasks, plus that seller.
- **Task:**
  - set up the assistant from its agent page (§22.5 i);
  - fund the service;
  - let the assistant make at least 10 paid calls over at least 3 days;
  - handle one "ask for more" request through the inbox;
  - take back what's left after the end date.
- **Baseline:** how each participant pays for the same service today (API credits or a card): setup time and total cost over the same period.
- **Measured (reported separately):**
  - time to the first paid call;
  - calls accepted, delivered and collected;
  - requests asked, approved and declined;
  - unknown outcomes and their resolution time;
  - the amount taken back, and how long it sat unused;
  - repeat choice ("would you fund it again?").
- **Comprehension check before funding:** each person explains, unprompted:
  - who can spend it;
  - where it can be spent;
  - how much, and until when;
  - that it can't be cancelled early;
  - that leftovers are taken back, not returned by themselves.
- **Success threshold:**
  - all 3 complete the task;
  - at least 2 of 3 pass the comprehension check without help;
  - zero charged-twice or wrong-seller incidents;
  - the seller collects everything served before expiry.
- **Stop rules:** any double charge, any payment to a wrong address, any lost key without a recovery path, or any failure of C1, S1–S4 or I1–I7.

## Pilot 2: one known shop with one till

- **Shop:** one café or canteen the founder knows (**input needed**), with regular customers.
- **Participants:** the shop plus 3 to 5 regulars; each gets a small budget from someone they know (a gift or allowance).
- **Task:**
  - one week of real purchases at one till;
  - at least one period offline;
  - one collection;
  - the funders take back what's left after the end date.
- **Baseline:** how the same purchases are paid for today (cash or card), and how long checkout takes.
- **Measured:**
  - checkout time;
  - purchases accepted as covered vs at the shop's own risk;
  - offline acceptances and how they reconciled;
  - collection before expiry;
  - the shop's and customers' explanations of the commitment.
- **Success threshold:**
  - checkout no slower than today's median;
  - no disputed purchases;
  - every covered purchase collected;
  - the shop can say what "at your own risk" means.
- **Stop rules:** any purchase accepted as covered that couldn't be collected, or any offline exposure above the till's allowance.

## Both pilots

- Testnet only. Amounts read "test USDC" on every screen.
- Opt-in, privacy-preserving notes. Never log keys, grants or private request text.
- The public metric, if one is published: **paid collections by buyers unrelated to the seller**.
