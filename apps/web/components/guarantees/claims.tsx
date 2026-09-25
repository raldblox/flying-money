/** The three claims (§4.1), each with a small picture. Static: server-rendered. */
export function Claims() {
  const cards = [
    {
      n: '1',
      title: 'The money is really there',
      plain: 'When the budget is created, the USDC is set aside on the blockchain. Only this seller can collect it.',
      exact: 'Every redeemable note is backed by funds reserved exclusively for its payee until the budget expires.',
      art: <ArtReserved />,
    },
    {
      n: '2',
      title: 'It can never go over',
      plain: 'The agent, or whoever holds the key, can’t sign for more than the budget. Not even if the key is stolen.',
      exact: 'The spender cannot authorize more than the certificate’s face value.',
      art: <ArtCap />,
    },
    {
      n: '3',
      title: 'Only the named seller gets paid',
      plain: 'Anyone may send a payment slip to the blockchain, but the money can only land with the seller you chose.',
      exact: 'Anyone can redeem a redeemable note, but its value can only be delivered to the certificate’s payee.',
      art: <ArtOnlyPayee />,
    },
  ]
  return (
    <ol className="grid gap-5 md:grid-cols-3">
      {cards.map((c) => (
        <li key={c.n} className="sheet flex flex-col p-5">
          <div className="flex items-center gap-3">
            <span className="grid size-9 place-items-center rounded-[3px] bg-seal font-display text-xl font-semibold text-paper">
              {c.n}
            </span>
            <h3 className="font-display text-2xl font-semibold leading-tight">{c.title}</h3>
          </div>
          <div className="my-4 rounded-md border border-line bg-paper-2/50 p-3">{c.art}</div>
          <p className="text-ink">{c.plain}</p>
          <p className="mt-3 border-t border-line pt-3 text-sm text-ink-2">
            <span className="smallcaps text-xs">Exact claim · </span>
            {c.exact}
          </p>
        </li>
      ))}
    </ol>
  )
}

const svg = { viewBox: '0 0 240 110', className: 'w-full', role: 'img' as const, fontFamily: 'var(--font-sans)' }

function ArtReserved() {
  return (
    <svg {...svg} aria-label="5 USDC locked, labelled for one seller only">
      <rect x="70" y="14" width="100" height="62" rx="8" fill="var(--paper)" stroke="var(--seal)" strokeWidth="2" />
      <path d="M112 30 v-6 a8 8 0 0 1 16 0 v6" fill="none" stroke="var(--ink)" strokeWidth="2" />
      <rect x="108" y="30" width="24" height="16" rx="3" fill="var(--ink)" />
      <text x="120" y="64" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--ink)">
        5.00 USDC
      </text>
      <rect x="62" y="84" width="116" height="20" rx="10" fill="var(--paper)" stroke="var(--line)" />
      <text x="120" y="98" textAnchor="middle" fontSize="10.5" fill="var(--ink-2)">
        reserved for one seller
      </text>
    </svg>
  )
}

function ArtCap() {
  return (
    <svg {...svg} aria-label="A budget bar: signed 3.70 of 5.00, with a hard ceiling at 5.00">
      <rect x="16" y="36" width="208" height="22" rx="3" fill="var(--paper)" stroke="var(--line)" />
      <rect x="16" y="36" width="154" height="22" rx="3" fill="var(--celadon)" />
      <line x1="224" y1="22" x2="224" y2="72" stroke="var(--seal)" strokeWidth="4" />
      <text x="228" y="16" textAnchor="end" fontSize="10.5" fill="var(--seal)">
        ceiling 5.00
      </text>
      <text x="16" y="80" fontSize="11" fill="var(--ink-2)" fontFamily="var(--font-mono)">
        signed 3.70
      </text>
      <g transform="translate(160 86)">
        <rect width="64" height="20" rx="3" fill="var(--paper)" stroke="var(--seal)" strokeDasharray="3 3" />
        <text x="32" y="14" textAnchor="middle" fontSize="10.5" fontFamily="var(--font-mono)" fill="var(--seal)">
          5.10 ✗
        </text>
      </g>
    </svg>
  )
}

function ArtOnlyPayee() {
  return (
    <svg {...svg} aria-label="Money can reach the chosen seller, never anyone else">
      <circle cx="30" cy="55" r="16" fill="var(--paper)" stroke="var(--ink)" strokeWidth="2" />
      <text x="30" y="59" textAnchor="middle" fontSize="11" fontWeight="600" fill="var(--ink)">
        $
      </text>
      <path d="M48 50 C 100 30, 150 26, 186 28" fill="none" stroke="var(--celadon)" strokeWidth="2.5" />
      <path
        d="M48 62 C 100 80, 150 86, 186 86"
        fill="none"
        stroke="var(--line)"
        strokeWidth="2"
        strokeDasharray="4 5"
      />
      <g transform="translate(206 28)">
        <circle r="15" fill="var(--paper)" stroke="var(--celadon)" strokeWidth="2" />
        <path d="M-6 0 l4 4 l8 -8" stroke="var(--celadon)" strokeWidth="2.5" fill="none" />
      </g>
      <text x="206" y="56" textAnchor="middle" fontSize="10" fill="var(--ink-2)">
        your seller
      </text>
      <g transform="translate(206 86)">
        <circle r="15" fill="var(--paper)" stroke="var(--seal)" strokeWidth="2" />
        <path d="M-5 -5 l10 10 M5 -5 l-10 10" stroke="var(--seal)" strokeWidth="2.5" />
      </g>
      <text x="150" y="108" textAnchor="middle" fontSize="10" fill="var(--ink-2)">
        anyone else
      </text>
    </svg>
  )
}
