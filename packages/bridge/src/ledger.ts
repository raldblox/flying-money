import { appendFileSync, existsSync, readFileSync } from 'node:fs'

/** One line of the bridge's public activity log. No agent addresses or request bodies: only what a monitor needs. */
export interface LedgerEntry {
  at: number
  kind: 'paid' | 'failed' | 'collected'
  /** the site's hostname (paid, failed) */
  host?: string
  network?: string
  /** USDC base units the bridge paid the site, or collected from the contract */
  amount: string
  /** what the agent was charged (paid), including the fee */
  price?: string
  /** the site's settlement transaction, or the collection transaction */
  tx?: string
  /** collected: what sending the collection transaction cost the bridge, in wei of the network's fee token */
  gas?: string
}

export interface Ledger {
  add(e: LedgerEntry): void
  recent(n: number): LedgerEntry[]
  totals(): {
    paid: number
    failed: number
    spent: bigint
    charged: bigint
    collected: bigint
    collections: number
    gas: bigint
    since: number
  }
}

/** Activity log kept in memory and, with a path, appended to a JSONL file so a restart keeps the history. */
export function createLedger(path?: string, now: () => number = Date.now): Ledger {
  const entries: LedgerEntry[] = []
  const since = now()
  if (path && existsSync(path)) {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      if (!line.trim()) continue
      try {
        entries.push(JSON.parse(line) as LedgerEntry)
      } catch {
        // a torn last line after a crash: skip it
      }
    }
  }
  return {
    add(e) {
      entries.push(e)
      if (path) appendFileSync(path, `${JSON.stringify(e)}\n`)
    },
    recent: (n) => entries.slice(-n).reverse(),
    totals() {
      let paid = 0
      let failed = 0
      let spent = 0n
      let charged = 0n
      let collected = 0n
      let collections = 0
      let gas = 0n
      for (const e of entries) {
        if (e.kind === 'paid') {
          paid++
          spent += BigInt(e.amount)
          charged += BigInt(e.price ?? e.amount)
        } else if (e.kind === 'failed') failed++
        else {
          collected += BigInt(e.amount)
          collections++
          gas += BigInt(e.gas ?? 0)
        }
      }
      return { paid, failed, spent, charged, collected, collections, gas, since: entries[0]?.at ?? since }
    },
  }
}
