import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Guarantees',
  description: 'What Flying Money guarantees, what it does not, the threat model, and what we removed and why.',
}

const PARTY = [
  [
    'Payee',
    'Every redeemable note is backed by funds reserved exclusively for it; redeeming a redeemable note pays exactly cumulative − redeemed.',
    'Redeems before expiry; token not frozen; chain live; its acceptance state is authoritative.',
  ],
  ['Funder', 'Never loses more than the face value; gets the remainder back after expiry.', '—'],
  ['Funder (spender key stolen)', 'Loss ≤ the remaining face value of certificates bound to that key.', '—'],
  [
    'Spender (agent or person)',
    'Cannot be charged more than the highest cumulative it signed; retries never create extra charges; network failures never raise its obligation.',
    'Signatures are over cumulative totals; requestId idempotency; durable outbox.',
  ],
  ['Everyone', 'Funds go only to the payee named at issuance.', '—'],
]

const THREATS = [
  [
    'Agent (spender) key stolen',
    'Attacker can pay only the named payee, up to the remaining face value',
    'Payee-scoped + cap',
  ],
  [
    'Agent goes rogue or loops',
    'Spending stops at the face value; the client also enforces a per-request price cap',
    'Cap on-chain and in the client',
  ],
  [
    'Payee tries to overcharge',
    'Not possible beyond notes the spender signed',
    'Notes are cumulative totals signed by the spender',
  ],
  [
    'Payee serves nothing',
    'The funder loses up to what the agent signed',
    'Payment ≠ service; bounded by the face value',
  ],
  ['Funder tries to pull funds early', 'Not possible', 'No cancel; reclaim only after expiry'],
  [
    'Very short expiry',
    'Rejected below 1 h by the contract; servers require a minimum remaining lifetime',
    'Contract + server checks',
  ],
  ['Replay on another chain or contract', 'Invalid', 'EIP-712 domain'],
  ['Signature malleability', 'Rejected', 'OpenZeppelin ECDSA low-s'],
  ['Front-running a redeem', 'Harmless', 'Funds always go to the payee'],
  [
    'Payee runs two servers without a shared store',
    'The payee may serve more than it can redeem (its own loss)',
    'The store must be shared',
  ],
  ['Payee misses expiry', 'The payee loses unredeemed value', 'The redeemer’s safety margin and alerts'],
  [
    'Hostile or unusual token behaviour',
    'Out of the attack surface',
    'One immutable token per deployment (Circle USDC)',
  ],
  [
    'Contract-signature (ERC-1271) revocation',
    'Not applicable',
    'Spenders are ECDSA-only; validity never depends on chain state',
  ],
  ['Buyer retries after a timeout', 'No double charge, no duplicate side effect', 'requestId idempotency'],
  ['Buyer crashes mid-request', 'No higher note is ever signed; the pending note is resent', 'Durable outbox'],
  [
    'Seller crashes after accepting, before serving',
    'The retry resumes it; otherwise the sweeper resolves it',
    'Idempotent application status',
  ],
  [
    'Many concurrent requests reusing the same credit',
    'Only as many are admitted as the credit allows',
    'Reserved accounting with an atomic re-check',
  ],
  ['Funder’s own wallet as the spender, or payee = spender', 'Rejected by the contract', 'Structural key isolation'],
  [
    'Unaudited contract bug on mainnet',
    'Exposure bounded deployment-wide',
    '1,000 USDC deployment cap + 100 USDC per certificate',
  ],
  ['Stablecoin freeze or blocklist', 'Funds stuck', 'Inherent to the token; disclosed'],
  [
    'The RPC lies to the seller',
    'The seller may accept notes against a fake certificate',
    'Use a trusted RPC; disclosed',
  ],
  [
    'Customer’s phone stolen',
    'The thief can spend only at the named shop(s), up to the remaining face value',
    'Payee-scoped + cap; PIN-encrypted key',
  ],
  [
    'Several POS devices offline and unsynced',
    'The same range may be accepted twice (the shop’s own loss)',
    'Primary-POS rule or per-device float',
  ],
  ['Gift link forwarded or leaked', 'Whoever holds it can spend it, at that shop only', 'Treat gift links like cash'],
  [
    'First-time customer while the POS is offline',
    'A fabricated certificate is possible',
    'Shown as UNVERIFIED · merchant risk, capped by the first-visit limit',
  ],
  [
    'Agent tries to raise its own budget via MCP',
    'Not possible',
    'No issue or top-up tools; the agent key isn’t the funder',
  ],
  [
    'Seller’s store is wiped',
    'Old notes never count as new value; the seller loses at most its redemption lag',
    'RECOVERED state; the buyer never loses credit',
  ],
  [
    'Onlookers analyse the chain',
    'They see addresses, amounts and times, not names',
    'Fresh keys for people; names never on-chain',
  ],
  [
    'Fake shop in Places',
    'A funder could lock money for a scammer',
    'Places are added by in-person QR scan or the seller’s own domain',
  ],
]

export default function GuaranteesPage() {
  return (
    <article className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="smallcaps text-sm text-seal">Guarantees</p>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight">What’s guaranteed, and what isn’t.</h1>

      <p className="mt-6 sheet p-5 text-ink-2">
        <strong className="text-ink">Audit status: not audited.</strong> Invariant- and property-tested. Testnets only
        for now. Mainnets will launch with immutable caps (100 USDC per certificate, 1,000 USDC deployment-wide).
      </p>

      <h2 className="mt-12 font-display text-3xl font-semibold">The three claims we make, and no stronger ones</h2>
      <ol className="mt-4 list-decimal space-y-2 pl-6 text-lg">
        <li>
          Every redeemable note is backed by funds reserved exclusively for its payee until the certificate expires.
        </li>
        <li>The spender cannot authorize more than the certificate’s face value.</li>
        <li>Anyone can redeem a redeemable note, but its value can only be delivered to the certificate’s payee.</li>
      </ol>

      <h2 className="mt-12 font-display text-3xl font-semibold">What each party is guaranteed</h2>
      <div className="mt-4 sheet overflow-x-auto px-2 py-2">
        <table className="ledger-table w-full min-w-[640px] text-left text-sm">
          <thead className="text-ink">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Party
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Guarantee
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Conditions
              </th>
            </tr>
          </thead>
          <tbody>
            {PARTY.map(([p, g, c]) => (
              <tr key={p} className="border-t border-line align-top">
                <th scope="row" className="px-4 py-3 font-medium">
                  {p}
                </th>
                <td className="px-4 py-3">{g}</td>
                <td className="px-4 py-3 text-ink-2">{c}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-ink-2">
        <strong className="text-ink">Not guaranteed:</strong> that the payee delivers the service; that notes reach the
        payee (if a note is lost, the payee just doesn’t serve). The payee must redeem before expiry. The stablecoin
        issuer can freeze funds. Chain liveness is assumed at redemption time.
      </p>

      <h2 className="mt-12 font-display text-3xl font-semibold">Control: what a funder can and can’t do</h2>
      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <ul className="list-disc space-y-2 pl-5">
          <li>Choose exactly where money can be spent (one certificate per place).</li>
          <li>Choose how much, and top up at any time.</li>
          <li>Choose how long, and extend it.</li>
          <li>Not renew: small amounts on short cycles work as an allowance.</li>
        </ul>
        <ul className="list-disc space-y-2 pl-5 text-ink-2">
          <li>Can’t freeze or cancel a certificate before expiry.</li>
          <li>Can’t lower a limit after issuing.</li>
          <li>Can’t block one purchase at an allowed place.</li>
          <li>Can’t see purchases before the shop collects, unless the holder’s app sends receipts.</li>
        </ul>
      </div>
      <p className="mt-4 text-ink-2">
        There is no freeze button on purpose: the seller accepts notes instantly, even offline, only because the money
        can’t be pulled back. Control happens at issue and renewal time.
      </p>

      <h2 className="mt-12 font-display text-3xl font-semibold">Privacy</h2>
      <p className="mt-4 text-lg">
        Payments are public on the blockchain but not linked to names. Anyone can see that some address paid a canteen,
        but not who. We don’t claim anonymity: flows between addresses are public.
      </p>

      <h2 className="mt-12 font-display text-3xl font-semibold">Threat model</h2>
      <div className="mt-4 sheet overflow-x-auto px-2 py-2">
        <table className="ledger-table w-full min-w-[720px] text-left text-sm">
          <thead className="text-ink">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Threat
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Outcome
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Why
              </th>
            </tr>
          </thead>
          <tbody>
            {THREATS.map(([t, o, w]) => (
              <tr key={t} className="border-t border-line align-top">
                <th scope="row" className="px-4 py-3 font-medium">
                  {t}
                </th>
                <td className="px-4 py-3">{o}</td>
                <td className="px-4 py-3 text-ink-2">{w}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-ink-2">
        <strong className="text-ink">Out of scope, stated plainly:</strong> paying strangers offline; strong privacy;
        freezing a certificate early (by design); disputes and refunds.
      </p>

      <h2 className="mt-12 font-display text-3xl font-semibold">What we removed, and why</h2>
      <p className="mt-4 text-lg">
        We began by building offline cash. Our own adversarial review showed that software alone cannot stop someone
        paying two offline strangers with the same money. So we cut everything that couldn’t be guaranteed:
      </p>
      <ul className="mt-4 list-disc space-y-2 pl-5 text-ink-2">
        <li>
          <strong className="text-ink">Shared spending pools.</strong> One reservation could pay any receiver, so only
          the first to redeem got paid. Replaced by payee-scoped certificates.
        </li>
        <li>
          <strong className="text-ink">Endorsement chains.</strong> An endorser could redeem first and cancel the
          downstream holder’s value. Deleted.
        </li>
        <li>
          <strong className="text-ink">The master key signing everything.</strong> Replaced by a separate spender key
          per certificate, so a compromise is bounded by the face value.
        </li>
        <li>
          <strong className="text-ink">One redemption per payment.</strong> Replaced by cumulative notes: one redemption
          covers any number of payments.
        </li>
        <li>
          <strong className="text-ink">“Payment complete ✓ / No double spends” marketing</strong> for offline
          acceptance, which was false. Replaced by this page.
        </li>
      </ul>
    </article>
  )
}
