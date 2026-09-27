/**
 * The one vocabulary (BUILD_SPEC §22.3). Every people- and agent-facing screen takes its words from here; code keeps
 * the protocol names (certificate, note, redeem, reclaim, funder, spender, payee). Published at /docs/glossary.
 */
export const TERMS = {
  budget: 'budget',
  fundedBy: 'Funded by',
  canUse: 'Can use',
  pays: 'Pays',
  seller: 'seller',
  sellers: 'Sellers',
  slip: 'payment slip',
  code: 'payment code',
  collect: 'Collect',
  reclaim: 'Take back what’s left',
  fee: 'network fee',
  openApp: 'Open app',
} as const

/** Rows of the public glossary: what people see, what agents see, what the code says. */
export const GLOSSARY: Array<{ people: string; agents: string; code: string; meaning: string }> = [
  {
    people: 'Budget',
    agents: 'budget',
    code: 'certificate',
    meaning: 'Money set aside in a public contract for one seller, one user and an end date.',
  },
  { people: 'Funded by', agents: 'owner', code: 'funder', meaning: 'Who put the money in.' },
  {
    people: 'Can use',
    agents: 'agent (spending key)',
    code: 'spender',
    meaning: 'The key that can sign payment slips.',
  },
  {
    people: 'Pays / Seller',
    agents: 'service',
    code: 'payee',
    meaning: 'The only address that can ever be paid from it.',
  },
  {
    people: 'Payment slip',
    agents: 'slip',
    code: 'note',
    meaning: 'A signed "total so far" for one budget. The seller checks it in milliseconds; no transaction.',
  },
  {
    people: 'Payment code',
    agents: '—',
    code: 'note (as a QR)',
    meaning: 'A payment slip shown as a QR code on the holder’s phone at a counter.',
  },
  {
    people: 'Collect',
    agents: 'collect',
    code: 'redeem',
    meaning: 'The seller sends slips to the contract and receives what was spent, in one transaction.',
  },
  {
    people: 'Take back what’s left',
    agents: 'reclaim',
    code: 'reclaim',
    meaning: 'After the end date, the funder takes the unspent money back with one transaction. It is not automatic.',
  },
  {
    people: 'Network fee',
    agents: 'gas',
    code: 'gas',
    meaning: 'What the blockchain charges for a transaction, paid by whoever sends it.',
  },
]

/** One status map everywhere (§22.3): "Ending soon" means 3 days or less. */
export const ENDING_SOON_DAYS = 3
export type BudgetState = 'active' | 'ending' | 'ended' | 'closed'
export const STATUS_LABEL: Record<BudgetState, string> = {
  active: 'Active',
  ending: 'Ending soon',
  ended: 'Ended',
  closed: 'Closed',
}

export function budgetState(
  c: { closed: boolean; expiresAt: bigint },
  now = BigInt(Math.floor(Date.now() / 1000)),
): BudgetState {
  if (c.closed) return 'closed'
  if (now > c.expiresAt) return 'ended'
  if (c.expiresAt - now <= BigInt(ENDING_SOON_DAYS) * 86_400n) return 'ending'
  return 'active'
}
