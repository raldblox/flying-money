'use client'
import { useState } from 'react'
import { IconIssue, IconRedeem, IconSeal, IconServe } from '@/components/art/ink-icons'

type Mode = 'plain' | 'technical'

const STEPS = [
  {
    Icon: IconIssue,
    t: 'Issue',
    where: 'on the blockchain · once',
    plain:
      'You lock 5 USDC for one seller. You choose who may spend it (a separate key, not your wallet) and when it ends. The money now sits in the contract, set aside for that seller.',
    technical: `issue(payee, spender, faceValue = 5_000_000, expiresAt)
→ id = keccak256(abi.encode(chainId, contract, funder, funderNonce))
→ event CertificateIssued(id, funder, payee, spender, faceValue, expiresAt)
Checks: spender ≠ funder, spender ≠ payee; lifetime 1 h … 365 d; caps.`,
  },
  {
    Icon: IconSeal,
    t: 'Seal',
    where: 'off-chain · every request',
    plain:
      'Each time the agent buys something, it signs a small slip with the running total: "total so far: 0.37". The total only ever goes up, so each new slip replaces the last one.',
    technical: `EIP-712 domain { name: "FlyingMoney", version: "1", chainId, verifyingContract }
Note(bytes32 certificateId, uint256 cumulative, bytes32 memo)
cumulative = max(accepted, consumed + price); memo = requestId
Saved to the durable outbox BEFORE sending (C1). Header: Flying-Money-Note: fm1.<base64url JSON>`,
  },
  {
    Icon: IconServe,
    t: 'Serve',
    where: 'off-chain · milliseconds',
    plain:
      'The seller checks the slip on the spot: right signature, right seller, still valid, within the budget. Nothing goes to the blockchain, so there is no waiting and no fee.',
    technical: `1. known requestId → stored outcome (replays are free, S1)
2. payee, closed, lifetime ≥ minRemainingLifetime, ECDSA signer == spender, cumulative ≤ faceValue
3. atomic begin: consumed + reserved + price ≤ max(accepted, cumulative) (S4)
4. serve → finish: success adds to consumed; failure becomes credit (S3)
Receipt: Flying-Money-Receipt { accepted, consumed, credit, remaining }`,
  },
  {
    Icon: IconRedeem,
    t: 'Redeem',
    where: 'on the blockchain · once for many',
    plain:
      'When it suits the seller, it sends the latest slip to the contract. One transaction collects everything so far. Anyone can send it, but the money only ever goes to the seller.',
    technical: `redeem(id, cumulative, memo, signature) or redeemMany(notes[])
pays cumulative − redeemed to payee; redeemed = cumulative
older or equal notes: NothingToRedeem (single) / NoteSkipped(reason 5) (batch)
The redeemer only redeems served value, before expiresAt − 30 min.`,
  },
  {
    Icon: IconIssue,
    t: 'Reclaim',
    where: 'on the blockchain · after the end date',
    plain:
      'After the end date, whatever was not spent goes back to you. Until then nobody can take it back, which is exactly why the seller can trust it.',
    technical: `reclaim(id) — funder only, after expiresAt
refunds faceValue − redeemed; closes the certificate
event CertificateReclaimed(id, refunded); no transfers after close (I6)`,
  },
]

export function Lifecycle() {
  const [mode, setMode] = useState<Mode>('plain')
  return (
    <div>
      <fieldset className="inline-flex rounded-[4px] border border-ink/25 bg-paper/70 p-1">
        <legend className="sr-only">Explanation style</legend>
        {(
          [
            ['plain', 'Plain words'],
            ['technical', 'Technical'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={mode === k}
            onClick={() => setMode(k)}
            className={`min-h-10 rounded-[3px] px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-indigo ${mode === k ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'}`}
          >
            {label}
          </button>
        ))}
      </fieldset>
      <ol className="relative mt-10 grid gap-8 border-l-2 border-dashed border-seal/50 pl-8">
        {STEPS.map(({ Icon, t, where, plain, technical }, k) => (
          <li key={t} className="relative">
            <span className="absolute -left-[3.05rem] top-1 grid size-10 place-items-center rounded-full bg-paper ring-1 ring-line">
              <Icon className="size-7" />
            </span>
            <div className="sheet p-6">
              <p className="smallcaps text-xs text-seal">
                Step {k + 1} · {where}
              </p>
              <h2 className="mt-1 font-display text-3xl font-semibold">{t}</h2>
              {mode === 'plain' ? (
                <p className="mt-2 max-w-2xl text-lg text-ink-2">{plain}</p>
              ) : (
                <pre className="mt-3 overflow-x-auto rounded border border-line bg-paper-2 p-4 font-mono text-sm leading-relaxed">
                  <code>{technical}</code>
                </pre>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
