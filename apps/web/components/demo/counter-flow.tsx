import { buttonClass } from '@/components/section'
import { usdc } from '@/lib/fmt'

/**
 * The counter demo's picture, always on screen: your wallet signs a slip, the till checks it on the spot, and the
 * chain only hears about it when the till collects. The switch between the till and the chain is the offline experiment.
 */
export function CounterFlow({
  ready,
  cut,
  accepted,
  pending,
  pulse,
  paying,
  canToggle,
  onToggle,
}: {
  ready: boolean
  cut: boolean
  accepted: bigint
  pending: bigint
  /** changes with every accepted payment, so the slip travels again */
  pulse: number
  paying: boolean
  canToggle: boolean
  onToggle: () => void
}) {
  const line = !ready
    ? 'Claim a test budget on the right to start.'
    : cut
      ? 'The till can’t reach the blockchain now. It still accepts slips from budgets it already checked.'
      : pending > 0n
        ? `${usdc(pending)} test USDC accepted and waiting to be collected. Press Collect below.`
        : 'Your wallet signs a slip. The till checks it on the spot. The chain only hears about it when the till collects.'
  return (
    <section className="demo-panel p-4 sm:p-5" aria-label="How this demo works">
      <VerticalFlow cut={cut} accepted={accepted} />
      <svg
        viewBox="0 0 960 190"
        role="img"
        aria-label="Your wallet hands a signed slip to the till. The till is connected to the blockchain, or cut off from it."
        className="hidden w-full sm:block"
      >
        {/* wallet → till */}
        <path d="M205 95 H395" className="stroke-ink" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        <text x="300" y="72" textAnchor="middle" className="fill-ink-2" fontSize="15">
          signed slip · no gas
        </text>
        {ready && (
          <g key={pulse} className={paying || pulse > 0 ? 'flow-dot' : 'hidden'}>
            <rect x="196" y="85" width="28" height="20" rx="3" className="fill-paper-2 stroke-seal" strokeWidth="2" />
            <path d="M202 92 H218 M202 98 H212" className="stroke-seal" strokeWidth="1.8" />
          </g>
        )}
        {/* till → chain */}
        <path
          d="M565 95 H755"
          className={cut ? 'stroke-seal' : 'stroke-ink-2'}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray="9 9"
          fill="none"
          opacity={cut ? 0.5 : 1}
        />
        {cut ? (
          <g>
            <circle cx="660" cy="95" r="18" className="fill-paper stroke-seal" strokeWidth="3" />
            <path
              d="M652 87 L668 103 M668 87 L652 103"
              className="stroke-seal"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
            <text x="660" y="140" textAnchor="middle" className="fill-seal" fontSize="15" fontWeight="600">
              connection cut
            </text>
          </g>
        ) : (
          <text x="660" y="72" textAnchor="middle" className="fill-ink-2" fontSize="15">
            collects later
          </text>
        )}
        {/* wallet */}
        <g transform="translate(110 95)">
          <rect x="-48" y="-62" width="96" height="124" rx="14" className="fill-paper stroke-ink" strokeWidth="2.5" />
          <path d="M-14 -50 H14" className="stroke-ink" strokeWidth="2.5" strokeLinecap="round" />
          <rect x="-30" y="-24" width="60" height="38" rx="5" className="fill-paper-2 stroke-ink-2" strokeWidth="1.8" />
          <text y="2" textAnchor="middle" className="fill-ink" fontSize="20" fontWeight="600">
            飛
          </text>
          <text y="88" textAnchor="middle" className="fill-ink" fontSize="18">
            Your wallet
          </text>
        </g>
        {/* till */}
        <g transform="translate(480 95)">
          <rect x="-84" y="-62" width="168" height="94" rx="10" className="fill-paper stroke-ink" strokeWidth="2.5" />
          <path d="M0 32 V58 M-46 62 H46" className="stroke-ink" strokeWidth="2.5" strokeLinecap="round" />
          <text y="-28" textAnchor="middle" className="fill-ink-2" fontSize="13" letterSpacing="2">
            TEA HOUSE TILL
          </text>
          <text y="6" textAnchor="middle" className="fill-ink" fontSize="30" fontWeight="600">
            {usdc(accepted)}
          </text>
          <text y="26" textAnchor="middle" className="fill-ink-2" fontSize="13">
            accepted
          </text>
          <text y="88" textAnchor="middle" className="fill-ink" fontSize="18">
            The shop
          </text>
        </g>
        {/* chain */}
        <g transform="translate(850 95)">
          <path d="M0 -58 L50 -30 V30 L0 58 L-50 30 V-30 Z" className="fill-paper stroke-ink" strokeWidth="2.5" />
          <path d="M-50 -30 L0 0 L50 -30 M0 0 V58" className="stroke-ink-2" strokeWidth="2" fill="none" />
          <text y="88" textAnchor="middle" className="fill-ink" fontSize="18">
            The blockchain
          </text>
        </g>
      </svg>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-sm text-ink-2" role="status">
          {line}
        </p>
        <button
          type="button"
          className={buttonClass(cut ? 'primary' : 'secondary')}
          onClick={onToggle}
          disabled={!canToggle}
        >
          {cut ? 'Reconnect the till' : 'Cut the till’s connection'}
        </button>
      </div>
      {!canToggle && ready && !cut && (
        <p className="mt-1 text-xs text-ink-2">The switch unlocks after your first purchase.</p>
      )}
    </section>
  )
}

/** The same picture, stacked, for phones: the three actors top to bottom. */
function VerticalFlow({ cut, accepted }: { cut: boolean; accepted: bigint }) {
  return (
    <svg
      viewBox="0 0 360 470"
      role="img"
      aria-label="Your wallet, then the till, then the blockchain."
      className="mx-auto w-full max-w-[19rem] sm:hidden"
    >
      <g transform="translate(180 62)">
        <rect x="-44" y="-52" width="88" height="104" rx="13" className="fill-paper stroke-ink" strokeWidth="2.5" />
        <rect x="-27" y="-22" width="54" height="34" rx="5" className="fill-paper-2 stroke-ink-2" strokeWidth="1.8" />
        <text y="2" textAnchor="middle" className="fill-ink" fontSize="18" fontWeight="600">
          飛
        </text>
        <text x="64" y="6" className="fill-ink" fontSize="16">
          Your wallet
        </text>
      </g>
      <path d="M180 120 V178" className="stroke-ink" strokeWidth="2.5" strokeLinecap="round" />
      <text x="196" y="154" className="fill-ink-2" fontSize="13">
        signed slip · no gas
      </text>
      <g transform="translate(180 232)">
        <rect x="-84" y="-48" width="168" height="92" rx="10" className="fill-paper stroke-ink" strokeWidth="2.5" />
        <text y="-22" textAnchor="middle" className="fill-ink-2" fontSize="12" letterSpacing="2">
          TEA HOUSE TILL
        </text>
        <text y="10" textAnchor="middle" className="fill-ink" fontSize="28" fontWeight="600">
          {usdc(accepted)}
        </text>
        <text y="30" textAnchor="middle" className="fill-ink-2" fontSize="12">
          accepted
        </text>
      </g>
      <path
        d="M180 286 V344"
        className={cut ? 'stroke-seal' : 'stroke-ink-2'}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeDasharray="9 9"
        opacity={cut ? 0.5 : 1}
      />
      {cut ? (
        <g>
          <circle cx="180" cy="315" r="15" className="fill-paper stroke-seal" strokeWidth="3" />
          <path
            d="M173 308 L187 322 M187 308 L173 322"
            className="stroke-seal"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
          <text x="204" y="320" className="fill-seal" fontSize="13" fontWeight="600">
            connection cut
          </text>
        </g>
      ) : (
        <text x="196" y="320" className="fill-ink-2" fontSize="13">
          collects later
        </text>
      )}
      <g transform="translate(180 408)">
        <path d="M0 -44 L38 -22 V22 L0 44 L-38 22 V-22 Z" className="fill-paper stroke-ink" strokeWidth="2.5" />
        <path d="M-38 -22 L0 0 L38 -22 M0 0 V44" className="stroke-ink-2" strokeWidth="2" fill="none" />
        <text x="62" y="6" className="fill-ink" fontSize="16">
          The blockchain
        </text>
      </g>
    </svg>
  )
}
