'use client'
import type { ReactNode } from 'react'
import { IconAgent, IconLedger, IconServe, IconShield, IconThief } from '@/components/art/ink-icons'
import type { Flight, Story, ThiefAttempt, Tone } from '@/lib/demo-story'
import { money } from '@/lib/demo-story'

const toneBar: Record<Tone, string> = {
  ink: 'bg-ink/40',
  seal: 'bg-seal',
  amber: 'bg-amber',
  celadon: 'bg-celadon',
  indigo: 'bg-indigo',
}

const PHASE_LABEL: Record<Story['phase'], string> = {
  idle: 'Ready',
  issuing: 'Step 1 · Lock the budget',
  paying: 'Step 2 · Pay per call',
  thief: 'Step 3 · Try to steal',
  done: 'Result',
  error: 'Stopped',
}

/**
 * The /demo stage: the agent, the seller and the blockchain, with every payment slip, answer, collection and
 * refusal drawn as it happens. Driven only by the story (the live event stream or the labelled illustration).
 */
export function DemoStage({
  story,
  mode,
  action,
}: {
  story: Story
  mode: 'live' | 'illustration'
  /** shown with the result: the next thing to do */
  action?: ReactNode
}) {
  const { caption } = story
  const down = story.network === 'down'
  return (
    <figure className="sheet overflow-hidden">
      {/* narration: what is happening right now, in plain words */}
      <div className="relative px-5 pt-5 sm:px-7 sm:pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`h-2 w-8 rounded-full ${toneBar[caption.tone]}`} aria-hidden />
          <p className="smallcaps text-xs text-ink-2">{PHASE_LABEL[story.phase]}</p>
          {mode === 'illustration' && (
            <span className="smallcaps ml-auto rounded-sm border border-line px-2 py-0.5 text-[0.7rem] text-ink-2">
              Illustration · not a live run
            </span>
          )}
        </div>
        <div aria-live="polite" className="min-h-[7.5rem] sm:min-h-[6.5rem]">
          <h3
            key={caption.title}
            className="caption-in mt-2 font-display text-2xl font-semibold leading-tight text-balance sm:text-3xl"
          >
            {caption.title}
          </h3>
          <p key={caption.detail} className="caption-in mt-1.5 max-w-3xl text-ink-2">
            {caption.detail}
          </p>
        </div>
      </div>

      {/* the three actors and what travels between them */}
      <div className="grid items-start gap-0 px-5 py-6 sm:px-7 md:grid-cols-[minmax(0,11rem)_minmax(0,1fr)_minmax(0,11rem)_minmax(0,1fr)_minmax(0,11rem)]">
        <Actor
          icon={<IconAgent className="size-10" />}
          name="AI agent"
          tagline="spends"
          stat={`signed ${money(story.signed)}`}
          sub={story.answers[0] ? `Got: ${story.answers[0]}` : 'Waiting for its budget'}
          active={story.phase === 'paying'}
        />
        <Lane
          top="signed slips"
          bottom="answers"
          flights={story.flights.filter((f) => f.lane === 'a' || f.lane === 'back')}
        />
        <Actor
          icon={<IconServe className="size-10" />}
          name="Silk Road Oracle"
          tagline="sells"
          stat={`${story.calls} call${story.calls === 1 ? '' : 's'} served`}
          sub={down ? 'Offline from the chain, still accepting' : 'Checks every slip itself'}
          pulse={story.stamp}
          warn={down}
        />
        <Lane
          top="collects"
          bottom="USDC"
          flights={story.flights.filter((f) => f.lane === 'b' || f.lane === 'coins')}
          broken={down}
        />
        <Actor
          icon={<IconLedger className="size-10" />}
          name="Blockchain"
          tagline={story.chainName || 'public ledger'}
          stat={`${money(story.collected)} collected`}
          sub={`${story.collections.length} transaction${story.collections.length === 1 ? '' : 's'}`}
          pulse={story.collections.length}
          tone="celadon"
        />
      </div>

      {story.phase === 'done' && story.done && <Result story={story} action={action} />}

      <div className="grid gap-6 border-t border-line bg-paper-2/40 px-5 py-6 sm:px-7">
        <BudgetBar story={story} />
        <CallsAndCollections story={story} mode={mode} />
        {story.thief.length > 0 && <ThiefRow attempts={story.thief} />}
      </div>
    </figure>
  )
}

/** The finale: the four numbers that matter, big. */
function Result({ story, action }: { story: Story; action?: ReactNode }) {
  const d = story.done!
  const tiles = [
    { big: String(d.served), small: 'paid API calls' },
    { big: String(d.redemptions), small: `blockchain transaction${d.redemptions === 1 ? '' : 's'}` },
    { big: money(BigInt(d.redeemed)), small: 'USDC to the seller, exactly what it served' },
    { big: money(BigInt(d.remaining)), small: 'USDC goes back to the owner' },
  ]
  return (
    <div className="caption-in border-t border-line px-5 py-6 sm:px-7">
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.small} className="rounded-md border border-line bg-paper p-4">
            <p className="font-display text-4xl font-semibold tabular-nums sm:text-5xl">{t.big}</p>
            <p className="mt-1 text-sm text-ink-2">{t.small}</p>
          </li>
        ))}
      </ul>
      {action && <div className="mt-5 flex flex-wrap items-center gap-3">{action}</div>}
    </div>
  )
}

function Actor({
  icon,
  name,
  tagline,
  stat,
  sub,
  pulse,
  active,
  warn,
  tone,
}: {
  icon: ReactNode
  name: string
  tagline: string
  stat: string
  sub: string
  pulse?: number
  active?: boolean
  warn?: boolean
  tone?: 'celadon'
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 md:flex-col md:text-center">
      <div
        key={pulse}
        className={`grid size-20 shrink-0 place-items-center rounded-full border-2 bg-paper ${pulse ? 'stage-pulse' : ''} ${warn ? 'border-amber text-amber' : tone === 'celadon' ? 'border-celadon text-ink' : active ? 'border-seal text-ink' : 'border-line text-ink'}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="font-display text-lg font-semibold leading-tight">{name}</p>
        <p className="smallcaps text-[0.7rem] text-ink-2">{tagline}</p>
        <p className="mt-1 font-mono text-sm tabular-nums">{stat}</p>
        <p className={`mt-0.5 line-clamp-2 text-xs ${warn ? 'text-amber' : 'text-ink-2'}`}>{sub}</p>
      </div>
    </div>
  )
}

function Lane({ top, bottom, flights, broken }: { top: string; bottom: string; flights: Flight[]; broken?: boolean }) {
  return (
    <div className="lane mx-auto my-2 h-24 w-16 md:mx-2 md:my-0 md:h-20 md:w-auto">
      {/* the wire: a dashed road that marches while things travel; broken in two when the network is cut */}
      <svg
        className="absolute inset-0 size-full overflow-visible"
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
        aria-hidden
      >
        <g className="hidden md:inline">
          {broken ? (
            <>
              <path
                d="M0 50 H40"
                stroke="var(--amber)"
                strokeWidth="2"
                strokeDasharray="5 5"
                vectorEffect="non-scaling-stroke"
              />
              <path
                d="M60 50 H100"
                stroke="var(--amber)"
                strokeWidth="2"
                strokeDasharray="5 5"
                vectorEffect="non-scaling-stroke"
              />
            </>
          ) : (
            <path
              className={flights.length ? 'wire-live' : ''}
              d="M0 50 H100"
              stroke="var(--line)"
              strokeWidth="2"
              strokeDasharray="6 8"
              vectorEffect="non-scaling-stroke"
            />
          )}
        </g>
        <g className="md:hidden">
          <path
            d="M50 0 V100"
            stroke={broken ? 'var(--amber)' : 'var(--line)'}
            strokeWidth="2"
            strokeDasharray="6 8"
            vectorEffect="non-scaling-stroke"
          />
        </g>
      </svg>
      <span className="smallcaps absolute -top-3 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[0.65rem] text-ink-2 md:block">
        {top} →
      </span>
      <span className="smallcaps absolute -bottom-3 left-1/2 hidden -translate-x-1/2 whitespace-nowrap text-[0.65rem] text-ink-2 md:block">
        ← {bottom}
      </span>
      {broken && (
        <span className="absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm border border-amber bg-paper px-1.5 py-0.5 text-[0.7rem] font-semibold text-amber">
          ✂ offline
        </span>
      )}
      {flights.map((f) => (
        <FlightItem key={f.id} f={f} />
      ))}
    </div>
  )
}

function FlightItem({ f }: { f: Flight }) {
  if (f.lane === 'a')
    return (
      <span className="flight flight-fwd z-20 flex items-center gap-1 rounded-[3px] border border-seal/60 bg-paper px-1.5 py-0.5 font-mono text-[0.7rem] tabular-nums shadow-sm">
        <span className="size-1.5 rounded-full bg-seal" aria-hidden />
        total {f.label}
      </span>
    )
  if (f.lane === 'back')
    return (
      <span className="flight flight-back z-10 rounded-full border border-line bg-paper-2 px-1.5 py-0.5 text-[0.7rem] text-ink-2">
        answer
      </span>
    )
  if (f.lane === 'b')
    return (
      <span className="flight flight-fwd z-20 flex items-center gap-1 rounded-[3px] border border-indigo/60 bg-paper px-1.5 py-0.5 font-mono text-[0.7rem] tabular-nums shadow-sm">
        ▤ {f.label}
      </span>
    )
  return (
    <span className="flight flight-back z-10 flex gap-0.5" aria-hidden>
      <span className="size-3 rounded-full border border-ochre bg-ochre/60" />
      <span className="size-3 rounded-full border border-ochre bg-ochre/60" />
      <span className="size-3 rounded-full border border-ochre bg-ochre/60" />
    </span>
  )
}

/** The budget as one bar: collected, waiting to be collected, signed but not served, and what stays with the owner. */
function BudgetBar({ story }: { story: Story }) {
  const face = story.face > 0n ? story.face : 300_000n
  const pct = (v: bigint) => Number((v * 10_000n) / face) / 100
  const collected = story.collected
  const waiting = story.served > collected ? story.served - collected : 0n
  const unspent = face > story.served ? face - story.served : 0n
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">The budget: {money(face)} USDC</p>
        <p className="text-xs text-ink-2">The agent can never sign past the right edge.</p>
      </div>
      <div
        className="relative mt-2 flex h-6 overflow-hidden rounded-sm border border-line bg-paper"
        role="img"
        aria-label={`${money(collected)} collected, ${money(waiting)} waiting to be collected, ${money(unspent)} unspent of ${money(face)} USDC`}
      >
        <div
          className="h-full bg-celadon motion-safe:transition-[width] motion-safe:duration-700"
          style={{ width: `${pct(collected)}%` }}
        />
        <div
          className="h-full bg-[repeating-linear-gradient(135deg,var(--celadon)_0_6px,transparent_6px_10px)] motion-safe:transition-[width] motion-safe:duration-700"
          style={{ width: `${pct(waiting)}%` }}
        />
        <span className="absolute inset-y-0 right-0 w-1 bg-seal" aria-hidden />
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <Legend swatch="bg-celadon" label="Collected by the seller" value={money(collected)} />
        <Legend
          swatch="bg-[repeating-linear-gradient(135deg,var(--celadon)_0_4px,transparent_4px_7px)] border border-celadon"
          label="Served, not yet collected"
          value={money(waiting)}
        />
        <Legend swatch="border border-line bg-paper" label="Unspent: returns to the owner" value={money(unspent)} />
      </ul>
    </div>
  )
}

function Legend({ swatch, label, value }: { swatch: string; label: string; value: string }) {
  return (
    <li className="flex items-center gap-2">
      <span className={`inline-block size-3 rounded-sm ${swatch}`} aria-hidden />
      <span className="text-ink-2">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </li>
  )
}

/** 20 calls on top, the few transactions that collected them underneath: the batching, visible. */
function CallsAndCollections({ story, mode }: { story: Story; mode: 'live' | 'illustration' }) {
  const total = Math.max(20, story.calls)
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">
          {story.calls} paid call{story.calls === 1 ? '' : 's'} → {story.collections.length} blockchain transaction
          {story.collections.length === 1 ? '' : 's'}
        </p>
        <p className="text-xs text-ink-2">Each square is one API call paid with a slip.</p>
      </div>
      <div className="mt-3 grid gap-1 sm:gap-1.5" style={{ gridTemplateColumns: `repeat(${total}, minmax(0, 1fr))` }}>
        {Array.from({ length: total }, (_, i) => {
          const served = i < story.calls
          return (
            <span
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed positions, one per call
              key={i}
              className={`h-5 rounded-[2px] border sm:h-7 ${served ? 'cell-in border-seal bg-seal/35' : 'border-dashed border-line'}`}
              title={served ? `Call ${i + 1}` : undefined}
            />
          )
        })}
        {story.collections.map((c) => (
          <div
            key={c.id}
            className="bracket-in mt-1 flex flex-col items-stretch"
            style={{ gridColumn: `${c.from} / ${c.to + 1}`, gridRow: 2 }}
          >
            <span className="h-2 rounded-b-sm border-x-2 border-b-2 border-celadon" aria-hidden />
            <span className="mt-1 truncate text-center font-mono text-[0.7rem] tabular-nums sm:text-xs">
              {mode === 'live' && c.txUrl ? (
                <a className="text-indigo underline" href={c.txUrl} target="_blank" rel="noreferrer">
                  +{money(c.paid)} ↗
                </a>
              ) : (
                `+${money(c.paid)}`
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

const TARGET: Record<ThiefAttempt['target'], string> = {
  seller: 'The Silk Road Oracle',
  contract: 'The blockchain contract',
  'other-seller': 'A different seller',
}

function ThiefRow({ attempts }: { attempts: ThiefAttempt[] }) {
  return (
    <div>
      <p className="flex items-center gap-2 font-semibold">
        <IconThief className="size-7 text-ink" /> Someone stole the agent’s key
      </p>
      <ol className="mt-3 grid gap-3 md:grid-cols-3">
        {attempts.map((a, i) => (
          <li key={a.id} className="caption-in relative overflow-hidden rounded-md border border-line bg-paper p-4">
            <p className="smallcaps text-[0.7rem] text-ink-2">Attempt {i + 1}</p>
            <p className="mt-1 text-sm font-medium">{a.title}</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="thief-shot rounded-[3px] border border-seal bg-seal/10 px-1.5 py-0.5 font-mono text-[0.7rem] text-seal">
                slip
              </span>
              <IconShield className="size-9 text-ink" />
              <span className="text-xs text-ink-2">{TARGET[a.target]}</span>
            </div>
            <p className="mt-3 text-sm">{a.reason}</p>
            {a.refused && (
              <span className="refused-in absolute right-3 top-3 rounded-sm border-2 border-seal px-1.5 py-0.5 text-xs font-bold tracking-widest text-seal">
                REFUSED
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
