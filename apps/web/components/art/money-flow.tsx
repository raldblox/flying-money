'use client'
import { useEffect, useId, useState } from 'react'

/**
 * The money flow in one picture (§11): the owner, the locked budget on the blockchain, the agent and the seller.
 * `step` picks what moves: 0 lock · 1 sign · 2 check · 3 collect · 4 leftovers back. Decorative motion (SVG SMIL,
 * looping while the step is shown) is dropped under prefers-reduced-motion; the labels carry the meaning.
 */
const CAST = {
  agents: {
    owner: ['Owner', 'funds the budget'],
    agent: ['Agent', 'signs slips'],
    seller: ['Seller', 'checks slips'],
    agentGlyph: 'agent',
  },
  people: {
    owner: ['Giver', 'gives the budget'],
    agent: ['Mia', 'shows her code'],
    seller: ['Café', 'the till checks'],
    agentGlyph: 'person',
  },
} as const

export function MoneyFlow({
  step,
  className = '',
  cast = 'agents',
}: {
  step: 0 | 1 | 2 | 3 | 4
  className?: string
  cast?: keyof typeof CAST
}) {
  const c = CAST[cast]
  const reduced = useReducedMotion()
  // unique per drawing: the page can hold several, and SVG ids are document-wide
  const uid = `mf${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const ref = (n: string) => `${uid}-${n}`
  const locked = step === 0 ? '5.00' : step >= 3 ? (step === 4 ? '0.00' : '4.63') : '5.00'
  const sellerGot = step >= 3 ? '0.37' : '0.00'
  const ownerBack = step === 4 ? '4.63' : ''
  const lit = (on: boolean) => (on ? 'var(--seal)' : 'var(--line)')
  return (
    <svg
      viewBox="0 0 520 320"
      className={className}
      role="img"
      aria-label={CAPTIONS[step]}
      fontFamily="var(--font-sans)"
    >
      <title>{CAPTIONS[step]}</title>
      {/* the two worlds: the blockchain (slow, public, final) and off-chain (instant, between two parties) */}
      <rect x="6" y="6" width="508" height="118" rx="10" fill="color-mix(in oklab, var(--indigo) 12%, transparent)" />
      <text x="20" y="28" fontSize="11" letterSpacing="1.5" fill="var(--indigo)">
        ON THE BLOCKCHAIN
      </text>
      <text x="20" y="150" fontSize="11" letterSpacing="1.5" fill="var(--ink-2)">
        OFF-CHAIN · INSTANT · FREE
      </text>

      {/* the locked budget */}
      <g transform="translate(195 40)">
        <rect
          width="130"
          height="68"
          rx="8"
          fill="var(--paper)"
          stroke={step === 0 || step >= 3 ? 'var(--seal)' : 'var(--line)'}
          strokeWidth="2"
        />
        <g transform="translate(5 0)">
          <path d="M52 16 v-6 a8 8 0 0 1 16 0 v6" fill="none" stroke="var(--ink)" strokeWidth="2" />
          <rect x="47" y="16" width="26" height="18" rx="3" fill="var(--ink)" />
        </g>
        <text x="65" y="54" textAnchor="middle" fontSize="15" fontWeight="600" fill="var(--ink)">
          {locked} USDC
        </text>
      </g>

      {/* actors */}
      <Actor
        x={70}
        y={236}
        label={c.owner[0]}
        sub={ownerBack ? `+${ownerBack} back` : c.owner[1]}
        on={step === 0 || step === 4}
        glyph="owner"
      />
      <Actor x={260} y={236} label={c.agent[0]} sub={c.agent[1]} on={step === 1 || step === 2} glyph={c.agentGlyph} />
      <Actor
        x={450}
        y={236}
        label={c.seller[0]}
        sub={step >= 3 ? `+${sellerGot} collected` : c.seller[1]}
        on={step >= 2 && step <= 3}
        glyph="seller"
      />

      {/* the guide lines each step uses */}
      <path
        id={ref('owner-box')}
        d="M80 206 C 110 140, 170 90, 206 76"
        fill="none"
        stroke={lit(step === 0)}
        strokeWidth="1.5"
        strokeDasharray="4 6"
      />
      <path
        id={ref('agent-seller')}
        d="M292 236 H 418"
        fill="none"
        stroke={lit(step === 2)}
        strokeWidth="1.5"
        strokeDasharray="4 6"
      />
      <path
        id={ref('seller-box')}
        d="M440 206 C 420 150, 360 100, 322 82"
        fill="none"
        stroke={lit(step === 3)}
        strokeWidth="1.5"
        strokeDasharray="4 6"
      />
      <path id={ref('box-seller')} d="M322 96 C 370 120, 420 160, 446 204" fill="none" stroke="none" />
      <path id={ref('box-owner')} d="M204 96 C 160 120, 110 160, 76 204" fill="none" stroke="none" />

      {/* step 0 · locking: the owner's coins go into the box on the blockchain */}
      {step === 0 && !reduced && <Coins path={`#${ref('owner-box')}`} />}

      {/* step 1 · paying: a signed slip goes with each request, nothing touches the blockchain */}
      {step === 1 &&
        (
          [
            ['first', '0.12'],
            ['second', '0.13'],
            ['third', '0.12'],
          ] as const
        ).map(([slip, v], i) => {
          const latest = i === 2
          return (
            <g key={slip} transform={`translate(${178 + i * 60} 158)`}>
              <rect
                width="52"
                height="26"
                rx="3"
                fill="var(--paper)"
                stroke={latest ? 'var(--seal)' : 'var(--line)'}
                strokeWidth={latest ? 2 : 1}
              />
              <text
                x="26"
                y="17"
                textAnchor="middle"
                fontSize="12"
                fontFamily="var(--font-mono)"
                fill={latest ? 'var(--ink)' : 'var(--ink-2)'}
              >
                {v}
              </text>
              {!reduced && (
                <animate
                  attributeName="opacity"
                  dur="3s"
                  repeatCount="indefinite"
                  values="0;0;1;1"
                  keyTimes={`0;${(i * 0.25).toFixed(2)};${(i * 0.25 + 0.08).toFixed(2)};1`}
                />
              )}
            </g>
          )
        })}
      {step === 1 && (
        <text x="260" y="198" textAnchor="middle" fontSize="10.5" fill="var(--ink-2)">
          a signed slip with each request · no fee, no wait
        </text>
      )}

      {/* step 2 · checking: slips fly agent → seller and get stamped; no blockchain involved */}
      {step === 2 && (
        <>
          <g>
            <rect x="-26" y="-11" width="52" height="22" rx="3" fill="var(--paper)" stroke="var(--seal)" />
            <text textAnchor="middle" y="4" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink)">
              0.12
            </text>
            {!reduced && (
              <animateMotion dur="1.4s" repeatCount="indefinite" rotate="0">
                <mpath href={`#${ref('agent-seller')}`} />
              </animateMotion>
            )}
            {reduced && (
              <animateMotion dur="0.01s" fill="freeze" keyPoints="0.5;0.5" keyTimes="0;1">
                <mpath href={`#${ref('agent-seller')}`} />
              </animateMotion>
            )}
          </g>
          <g transform="translate(476 198)">
            <circle r="13" fill="var(--seal)" />
            <path d="M-6 0 l4 4 l8 -8" stroke="var(--on-seal)" strokeWidth="2.5" fill="none" />
          </g>
        </>
      )}

      {/* step 3 · collecting: the latest slip goes up, the money comes down to the seller */}
      {step === 3 && !reduced && (
        <>
          <g>
            <rect x="-22" y="-10" width="44" height="20" rx="3" fill="var(--paper)" stroke="var(--seal)" />
            <text textAnchor="middle" y="4" fontSize="10" fontFamily="var(--font-mono)" fill="var(--ink)">
              0.37
            </text>
            <animateMotion dur="2.4s" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.45;1" calcMode="linear">
              <mpath href={`#${ref('seller-box')}`} />
            </animateMotion>
          </g>
          <Coins path={`#${ref('box-seller')}`} />
        </>
      )}

      {/* step 4 · leftovers: what was not spent flows back to the owner */}
      {step === 4 && (
        <>
          {!reduced && <Coins path={`#${ref('box-owner')}`} />}
          <g transform="translate(110 72)">
            <rect x="-58" y="-12" width="116" height="24" rx="12" fill="var(--paper)" stroke="var(--line)" />
            <text textAnchor="middle" y="4" fontSize="10.5" fill="var(--ink-2)">
              after the end date
            </text>
          </g>
        </>
      )}
    </svg>
  )
}

const CAPTIONS = [
  'The owner locks 5.00 USDC on the blockchain, for one seller only.',
  'With each request the agent hands over a signed slip: 0.12, 0.13, 0.12. Nothing is sent to the blockchain.',
  'Each slip goes straight to the seller, who checks and stamps it in milliseconds.',
  'Whenever it likes, the seller collects everything it earned (0.37) in one transaction.',
  'After the end date, the 4.63 USDC nobody spent goes back to the owner.',
] as const

function Coins({ path }: { path: string }) {
  return (
    <>
      {[0, 0.25, 0.5].map((d) => (
        <circle key={d} r="7" fill="var(--ochre)" stroke="var(--ink)" strokeWidth="1">
          <animateMotion
            dur="2.4s"
            begin={`${1.1 + d}s`}
            repeatCount="indefinite"
            keyPoints="0;1;1"
            keyTimes="0;0.4;1"
            calcMode="linear"
          >
            <mpath href={path} />
          </animateMotion>
          <animate
            attributeName="opacity"
            dur="2.4s"
            begin={`${1.1 + d}s`}
            repeatCount="indefinite"
            values="0;1;1;0;0"
            keyTimes="0;0.05;0.38;0.42;1"
          />
        </circle>
      ))}
    </>
  )
}

function Actor({
  x,
  y,
  label,
  sub,
  on,
  glyph,
}: {
  x: number
  y: number
  label: string
  sub: string
  on: boolean
  glyph: 'owner' | 'agent' | 'seller' | 'person'
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r="30" fill="var(--paper)" stroke={on ? 'var(--seal)' : 'var(--line)'} strokeWidth="2" />
      <g stroke="var(--ink)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {glyph === 'owner' && (
          <>
            <circle cx="0" cy="-8" r="7" />
            <path d="M-13 14 c2 -9 6 -13 13 -13 s11 4 13 13" />
          </>
        )}
        {glyph === 'person' && (
          <>
            <circle cx="0" cy="-9" r="6" />
            <path d="M-11 14 c2 -8 5 -12 11 -12 s9 4 11 12" />
            <rect x="7" y="-2" width="9" height="14" rx="1.5" />
          </>
        )}
        {glyph === 'agent' && (
          <>
            <rect x="-14" y="-12" width="28" height="20" rx="2" />
            <path d="M-8 -5 l4 3 l-4 3 M0 1 h7 M-5 14 h10" />
          </>
        )}
        {glyph === 'seller' && (
          <>
            <path d="M-15 -4 h30 c0 10 -6 16 -15 16 s-15 -6 -15 -16 z" />
            <path d="M-6 -9 c-2 -3 2 -5 0 -8 M4 -9 c-2 -3 2 -5 0 -8" />
          </>
        )}
      </g>
      <text y="48" textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--ink)">
        {label}
      </text>
      <text y="63" textAnchor="middle" fontSize="10.5" fill="var(--ink-2)">
        {sub}
      </text>
    </g>
  )
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(m.matches)
    const on = () => setReduced(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return reduced
}
