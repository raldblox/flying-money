'use client'
import { useEffect, useRef, useState } from 'react'
import { IconIssue, IconRedeem, IconSeal, IconServe } from '@/components/art/ink-icons'
import { MoneyFlow } from '@/components/art/money-flow'

type Mode = 'plain' | 'technical'

const STEPS = [
  {
    Icon: IconIssue,
    t: 'Lock the budget',
    fn: 'issue',
    where: 'on the blockchain · once',
    plain:
      'You set aside 5 USDC for one service and pick an end date. Your agent gets its own spending key, never your wallet. The money is now reserved for that service and nobody else.',
    technical: `issue(payee, spender, faceValue = 5_000_000, expiresAt)
→ id = keccak256(abi.encode(chainId, contract, funder, funderNonce))
→ event CertificateIssued(id, funder, payee, spender, faceValue, expiresAt)
Checks: spender ≠ funder, spender ≠ payee; lifetime 1 h … 365 d; caps.`,
  },
  {
    Icon: IconSeal,
    t: 'Pay as it goes',
    fn: 'seal',
    where: 'off-chain · every request',
    plain:
      'Each time your agent uses the service, it hands over a small signed slip. That’s the payment. There’s no transaction and no fee, and nothing happens in your wallet.',
    technical: `EIP-712 domain { name: "FlyingMoney", version: "1", chainId, verifyingContract }
Note(bytes32 certificateId, uint256 cumulative, bytes32 memo)
cumulative = max(accepted, consumed + price); memo = requestId
Saved to the durable outbox BEFORE sending (C1). Header: Flying-Money-Note: fm1.<base64url JSON>`,
  },
  {
    Icon: IconServe,
    t: 'Check and serve',
    fn: 'serve',
    where: 'off-chain · milliseconds',
    plain:
      'The service checks the slip on the spot: really from this agent, meant for this service, and inside the budget. If it checks out, it answers right away.',
    technical: `1. known requestId → stored outcome (replays are free, S1)
2. payee, closed, lifetime ≥ minRemainingLifetime, ECDSA signer == spender, cumulative ≤ faceValue
3. atomic begin: consumed + reserved + price ≤ max(accepted, cumulative) (S4)
4. serve → finish: success adds to consumed; failure becomes credit (S3)
Receipt: Flying-Money-Receipt { accepted, consumed, credit, remaining }`,
  },
  {
    Icon: IconRedeem,
    t: 'Collect',
    fn: 'redeem',
    where: 'on the blockchain · once for many',
    plain:
      'Later, the service collects what it earned, hundreds of payments in a single transaction. The money can only ever go to that service.',
    technical: `redeem(id, cumulative, memo, signature) or redeemMany(notes[])
pays cumulative − redeemed to payee; redeemed = cumulative
older or equal notes: NothingToRedeem (single) / NoteSkipped(reason 5) (batch)
The redeemer only redeems served value, before expiresAt − 30 min.`,
  },
  {
    Icon: IconIssue,
    t: 'Take back leftovers',
    fn: 'reclaim',
    where: 'on the blockchain · after the end date',
    plain:
      'After the end date, you take back whatever wasn’t spent, with one transaction. Until then it stays reserved, which is why the service can trust it.',
    technical: `reclaim(id) — funder only, after expiresAt
refunds faceValue − redeemed; closes the certificate
event CertificateReclaimed(id, refunded); no transfers after close (I6)`,
  },
]

export function Lifecycle() {
  const [mode, setMode] = useState<Mode>('plain')
  const [active, setActive] = useState(0)
  const items = useRef<Array<HTMLLIElement | null>>([])
  // scroll-driven: the step crossing the middle of the screen drives the diagram
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.step ?? 0))
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )
    for (const el of items.current) if (el) io.observe(el)
    return () => io.disconnect()
  }, [])
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
      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ol className="relative grid gap-8 border-l-2 border-dashed border-seal/50 pl-8 lg:gap-[28vh] lg:pb-[20vh]">
          {STEPS.map(({ Icon, t, fn, where, plain, technical }, k) => (
            <li
              key={t}
              ref={(el) => {
                items.current[k] = el
              }}
              data-step={k}
              className="relative"
            >
              <span
                className={`absolute -left-[3.05rem] top-1 grid size-10 place-items-center rounded-full bg-paper ring-1 transition-colors ${active === k ? 'text-seal ring-seal' : 'ring-line'}`}
              >
                <Icon className="size-7" />
              </span>
              <div className={`sheet p-6 transition-opacity lg:opacity-60 ${active === k ? 'lg:opacity-100' : ''}`}>
                <p className="smallcaps text-xs text-seal">
                  Step {k + 1} · {where}
                </p>
                <h2 className="mt-1 font-display text-3xl font-semibold">
                  {t}
                  {mode === 'technical' && <code className="ml-2 font-mono text-base text-ink-2">{fn}</code>}
                </h2>
                {mode === 'plain' ? (
                  <p className="mt-2 max-w-2xl text-lg text-ink-2">{plain}</p>
                ) : (
                  <pre className="mt-3 overflow-x-auto rounded border border-line bg-paper-2 p-4 font-mono text-sm leading-relaxed">
                    <code>{technical}</code>
                  </pre>
                )}
                {/* phones: each step carries its own picture */}
                <MoneyFlow step={k as 0 | 1 | 2 | 3 | 4} className="mt-4 w-full lg:hidden" />
              </div>
            </li>
          ))}
        </ol>
        <div className="hidden lg:block">
          <div className="sticky top-24">
            <div className="sheet p-4">
              <MoneyFlow step={active as 0 | 1 | 2 | 3 | 4} className="w-full" />
            </div>
            <ol className="mt-4 flex justify-center gap-2" aria-hidden>
              {STEPS.map((s, k) => (
                <li
                  key={s.t}
                  className={`h-1.5 w-10 rounded-full transition-colors ${k <= active ? 'bg-seal' : 'bg-line'}`}
                />
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  )
}
