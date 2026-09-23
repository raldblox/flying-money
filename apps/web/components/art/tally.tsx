/**
 * The certificate as a Tang tally: two paper halves with a seal stamped across the seam.
 * The seal is whole only when the halves meet — the way feiqian halves were matched (verifiable).
 * `joined` animates the halves together on mount (reduced motion: already joined).
 */
export function TallyArt({
  face = '5.00',
  payee = 'Silk Road Oracle',
  holder = 'Research agent',
  expires = '7 days',
  className = '',
}: {
  face?: string
  payee?: string
  holder?: string
  expires?: string
  className?: string
}) {
  // seam runs vertically at x = 360 with a torn zig-zag
  const seam = 'M360 18 L352 48 L366 78 L350 110 L368 142 L352 176 L366 210 L350 244 L364 276 L356 300'
  return (
    <svg
      viewBox="0 0 520 320"
      className={`tally-art ${className}`}
      role="img"
      aria-label={`A certificate for ${face} USDC, payable to ${payee}, held by ${holder}, valid for ${expires}. Illustration.`}
    >
      <defs>
        <clipPath id="left-half">
          <path d={`M0 0 L360 0 ${seam.replace('M360 18', 'L360 18')} L356 320 L0 320 Z`} />
        </clipPath>
        <clipPath id="right-half">
          <path d={`M520 0 L360 0 ${seam.replace('M360 18', 'L360 18')} L356 320 L520 320 Z`} />
        </clipPath>
      </defs>

      {/* LEFT half: the certificate */}
      <g className="tally-left">
        <g clipPath="url(#left-half)">
          <rect x="12" y="12" width="500" height="296" rx="3" fill="var(--paper)" filter="url(#deckle)" />
          <rect
            x="30"
            y="30"
            width="464"
            height="260"
            fill="none"
            stroke="var(--seal)"
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
          <text x="54" y="72" fontSize="12" letterSpacing="3" className="fill-ink-2" fontFamily="var(--font-sans)">
            CERTIFICATE · 飛錢
          </text>
          <text
            x="54"
            y="138"
            fontSize="64"
            fontWeight="600"
            className="fill-ink"
            fontFamily="var(--font-display)"
            style={{ fontVariantNumeric: 'lining-nums' }}
          >
            {face}
          </text>
          <text x="58" y="162" fontSize="12" className="fill-ink-2" fontFamily="var(--font-sans)">
            USDC face value
          </text>
          {(
            [
              ['Payable to', payee],
              ['Spent by', holder],
              ['Valid for', expires],
            ] as const
          ).map(([k, v], i) => (
            <g key={k} fontFamily="var(--font-sans)" fontSize="13">
              <text x="58" y={206 + i * 24} className="fill-ink-2">
                {k}
              </text>
              <text x="146" y={206 + i * 24} className="fill-ink" fontWeight="600">
                {v}
              </text>
              <line x1="146" x2="320" y1={212 + i * 24} y2={212 + i * 24} stroke="var(--line)" />
            </g>
          ))}
        </g>
        <path d={seam} fill="none" stroke="var(--line)" strokeWidth="1.2" />
      </g>

      {/* RIGHT half: the counterfoil, kept by the office */}
      <g className="tally-right">
        <g clipPath="url(#right-half)">
          <rect x="12" y="12" width="500" height="296" rx="3" fill="var(--paper)" filter="url(#deckle)" />
          <rect
            x="30"
            y="30"
            width="464"
            height="260"
            fill="none"
            stroke="var(--seal)"
            strokeOpacity="0.55"
            strokeWidth="1.5"
          />
          <g fontFamily="var(--font-han)" fontSize="22" className="fill-ink" opacity="0.8">
            <text x="440" y="84">
              飛
            </text>
            <text x="440" y="114">
              錢
            </text>
          </g>
          <line x1="410" x2="470" y1="250" y2="250" stroke="var(--line)" />
          <text x="440" y="270" textAnchor="middle" fontSize="10" className="fill-ink-2" fontFamily="var(--font-sans)">
            counterfoil
          </text>
        </g>
      </g>

      {/* the seal across the seam: each half carries half of it */}
      <g transform="rotate(-6 360 160)">
        <g className="tally-left" clipPath="url(#left-half)">
          <SealMark />
        </g>
        <g className="tally-right" clipPath="url(#right-half)">
          <SealMark />
        </g>
      </g>
    </svg>
  )
}

function SealMark() {
  return (
    <g filter="url(#ink-bleed)">
      <rect x="318" y="118" width="84" height="84" rx="6" fill="none" stroke="var(--seal)" strokeWidth="5" />
      <rect x="326" y="126" width="68" height="68" rx="3" fill="var(--seal)" fillOpacity="0.9" />
      <text x="360" y="176" textAnchor="middle" fontSize="44" fontFamily="var(--font-han)" fill="var(--paper)">
        飛
      </text>
    </g>
  )
}
