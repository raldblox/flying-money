// Turns the /demo event stream into a visual story: actors, flights, captions and totals. Pure, so the live run and
// the labelled illustration share it (and it is unit-tested). Amounts stay integer base units (bigint).

export type DemoEvent =
  | { type: 'start'; chain: string; chainName: string; explorer: string; face: string }
  | { type: 'info'; text: string; url?: string }
  | { type: 'issued'; certificateId: string; faceValue: string; expiresAt: string; txHash: string; txUrl: string }
  | { type: 'step'; text: string }
  | { type: 'sealed'; cumulative: string; requestId: string }
  | {
      type: 'accepted'
      path: string
      price: string
      status: string
      accepted: string
      consumed: string
      credit: string
    }
  | { type: 'redeemed'; paid: string; cumulative: string; txHash: string; txUrl: string }
  | { type: 'network'; down: boolean; text: string }
  | { type: 'thief'; attempt: string; refused: boolean; detail: string }
  | {
      type: 'done'
      calls: number
      served: number
      consumed: string
      redeemed: string
      redemptions: number
      remaining: string
      certificateUrl: string
      bestTrade?: { buy: string; sell: string; margin: number }
    }
  | { type: 'error'; message: string }

export type Tone = 'ink' | 'seal' | 'amber' | 'celadon' | 'indigo'

export interface Flight {
  id: number
  /** a: agent → seller (slip), back: seller → agent (answer), b: seller → chain (bundle), coins: chain → seller */
  lane: 'a' | 'back' | 'b' | 'coins'
  label: string
}

export interface Collection {
  id: number
  paid: bigint
  /** 1-based range of the paid calls this transaction collected */
  from: number
  to: number
  txUrl?: string
}

export interface ThiefAttempt {
  id: number
  target: 'seller' | 'contract' | 'other-seller'
  title: string
  refused: boolean
  reason: string
}

export interface Story {
  phase: 'idle' | 'issuing' | 'paying' | 'thief' | 'done' | 'error'
  chainName: string
  face: bigint
  /** highest total the agent has signed (the obligation) */
  signed: bigint
  /** total the seller has served */
  served: bigint
  collected: bigint
  calls: number
  /** calls collected so far (for the ranges of each collection) */
  collectedCalls: number
  flights: Flight[]
  collections: Collection[]
  answers: string[]
  network: 'up' | 'down'
  thief: ThiefAttempt[]
  caption: { title: string; detail: string; tone: Tone }
  certificateUrl?: string
  issueTxUrl?: string
  done?: Extract<DemoEvent, { type: 'done' }>
  /** a changing number, so components can re-trigger the seller's stamp */
  stamp: number
  error?: string
  seq: number
}

export const initialStory: Story = {
  phase: 'idle',
  chainName: '',
  face: 0n,
  signed: 0n,
  served: 0n,
  collected: 0n,
  calls: 0,
  collectedCalls: 0,
  flights: [],
  collections: [],
  answers: [],
  network: 'up',
  thief: [],
  caption: {
    title: 'An AI agent is about to pay for 20 API calls',
    detail: 'Watch each payment travel as a signed slip, and the seller collect them in a few transactions.',
    tone: 'ink',
  },
  stamp: 0,
  seq: 0,
}

const PATHS: Record<string, string> = {
  '/v1/tea-price': 'a tea price',
  '/v1/route': 'a trade route',
  '/v1/weather': 'live weather',
  '/v1/proverb': 'a proverb',
}

/** "0.1" → "0.10": display only. */
export function money(v: bigint): string {
  const neg = v < 0n
  const a = neg ? -v : v
  const whole = a / 1_000_000n
  const frac = (a % 1_000_000n).toString().padStart(6, '0').replace(/0+$/, '').padEnd(2, '0')
  return `${neg ? '-' : ''}${whole}.${frac}`
}

const MAX_FLIGHTS = 8
const push = (s: Story, f: Omit<Flight, 'id'>): Flight[] => [...s.flights, { ...f, id: s.seq }].slice(-MAX_FLIGHTS)

// The thief attempts arrive in a fixed order (apps/agent live.ts): overspend, redeem on-chain, pay another seller.
const THIEF: Array<{ target: ThiefAttempt['target']; title: string; refusal: string }> = [
  {
    target: 'seller',
    title: 'Signs a slip for more than the whole budget',
    refusal: 'The seller refuses: that is more than the budget holds.',
  },
  {
    target: 'contract',
    title: 'Asks the blockchain contract to pay that slip',
    refusal: 'The contract refuses: it can never pay more than was set aside.',
  },
  {
    target: 'other-seller',
    title: 'Tries to pay a different seller with the same key',
    refusal: 'Refused: this budget can only ever pay the Silk Road Oracle.',
  },
]

export function reduceStory(s: Story, e: DemoEvent): Story {
  const seq = s.seq + 1
  const n = { ...s, seq }
  switch (e.type) {
    case 'start':
      return {
        ...initialStory,
        seq,
        phase: 'issuing',
        chainName: e.chainName,
        face: BigInt(e.face),
        caption: {
          title: `Setting aside a ${money(BigInt(e.face))} USDC budget`,
          detail: `The owner locks test USDC on ${e.chainName} for one seller only: the Silk Road Oracle.`,
          tone: 'indigo',
        },
      }
    case 'issued':
      return {
        ...n,
        phase: 'paying',
        face: BigInt(e.faceValue),
        issueTxUrl: e.txUrl,
        caption: {
          title: 'Budget locked. The agent can start paying.',
          detail:
            'Only the Silk Road Oracle can be paid from it, only with this agent’s key, for 7 days. Leftovers go back to the owner.',
          tone: 'indigo',
        },
      }
    case 'sealed': {
      const cum = BigInt(e.cumulative)
      // each slip is labelled with what it adds, like a price tag, not with the running total (which read like a
      // bank balance to visitors); a resend or a request covered by credit adds nothing new
      const adds = cum > s.signed ? cum - s.signed : 0n
      return {
        ...n,
        signed: cum > s.signed ? cum : s.signed,
        flights: push(n, { lane: 'a', label: adds > 0n ? `+${money(adds)}` : 'slip' }),
      }
    }
    case 'accepted': {
      if (e.status !== 'SERVED') return n
      const calls = s.calls + 1
      return {
        ...n,
        calls,
        served: BigInt(e.consumed),
        stamp: s.stamp + 1,
        caption: {
          title: `Call ${calls}: paid ${money(BigInt(e.price))} for ${PATHS[e.path] ?? e.path}`,
          detail:
            'One signed slip, checked by the seller in milliseconds. No blockchain transaction, no gas, no waiting.',
          tone: s.network === 'down' ? 'amber' : 'ink',
        },
      }
    }
    case 'step': {
      const answer = e.text.includes(' → ') ? e.text.split(' → ').slice(1).join(' → ') : e.text
      if (e.text.startsWith('best trade')) return { ...n, answers: [e.text, ...s.answers].slice(0, 3) }
      return { ...n, answers: [answer, ...s.answers].slice(0, 3), flights: push(n, { lane: 'back', label: '' }) }
    }
    case 'redeemed': {
      const paid = BigInt(e.paid)
      const from = s.collectedCalls + 1
      const to = Math.max(s.calls, from)
      const c: Collection = { id: seq, paid, from, to, txUrl: e.txUrl || undefined }
      const withBundle = push(n, { lane: 'b', label: money(paid) })
      return {
        ...n,
        collected: s.collected + paid,
        collectedCalls: to,
        collections: [...s.collections, c],
        flights: [...withBundle, { id: seq + 0.5, lane: 'coins' as const, label: '' }].slice(-MAX_FLIGHTS),
        caption: {
          title: `The seller collects ${money(paid)} in one transaction`,
          detail:
            to > from
              ? `Calls ${from} to ${to} are settled together: one blockchain transaction instead of ${to - from + 1}.`
              : `Call ${from} is settled on the blockchain.`,
          tone: 'celadon',
        },
      }
    }
    case 'network':
      return {
        ...n,
        network: e.down ? 'down' : 'up',
        caption: e.down
          ? {
              title: 'Network cut: the seller can’t reach the blockchain',
              detail:
                'Payments keep flowing anyway. The seller remembers the budget and checks every slip itself. Collecting waits for the connection.',
              tone: 'amber',
            }
          : {
              title: 'Connection back',
              detail: 'One transaction collects everything that was accepted while the network was down.',
              tone: 'celadon',
            },
      }
    case 'thief': {
      const i = s.thief.length
      const t = THIEF[i] ?? { target: 'seller' as const, title: e.attempt, refusal: e.detail }
      const attempt: ThiefAttempt = {
        id: seq,
        target: t.target,
        title: t.title,
        refused: e.refused,
        reason: e.refused ? t.refusal : e.detail,
      }
      return {
        ...n,
        phase: 'thief',
        thief: [...s.thief, attempt],
        caption: {
          title: `A thief stole the agent’s key. Attempt ${i + 1} of 3.`,
          detail: `${t.title}. ${attempt.reason}`,
          tone: 'seal',
        },
      }
    }
    case 'done':
      return {
        ...n,
        phase: 'done',
        done: e,
        certificateUrl: e.certificateUrl,
        caption: {
          title: `${e.served} paid calls, ${e.redemptions} blockchain transaction${e.redemptions === 1 ? '' : 's'}`,
          detail: `The seller received exactly ${money(BigInt(e.redeemed))} USDC for what it served. ${money(BigInt(e.remaining))} USDC stays locked until the end date; then the owner can take it back.`,
          tone: 'celadon',
        },
      }
    case 'error':
      return {
        ...n,
        phase: 'error',
        error: e.message,
        caption: { title: 'The demo stopped', detail: e.message, tone: 'seal' },
      }
    default:
      return n
  }
}

/**
 * A scripted run for the illustration shown before (or instead of) a live run. It follows the live run's event order
 * and prices (apps/agent merchant plan and oracle prices) but carries no transaction links: it is never presented as
 * a real run.
 */
export function illustrationScript(opts: { cutNetwork: boolean; stealKey: boolean }): DemoEvent[] {
  const plan: Array<[string, bigint, string]> = [
    ...[
      '23 per jin (rising)',
      '19 per jin (steady)',
      '31 per jin (rising)',
      '27 per jin (falling)',
      '17 per jin (steady)',
      '24 per jin (rising)',
      '35 per jin (rising)',
      '22 per jin (falling)',
    ].map((a) => ['/v1/tea-price', 10_000n, a] as [string, bigint, string]),
    ...['28°C, wind 9 km/h', '21°C, wind 14 km/h', '30°C, wind 6 km/h', '27°C, wind 11 km/h'].map(
      (a) => ['/v1/weather', 10_000n, a] as [string, bigint, string],
    ),
    ...['4,200 li, ~84 caravan days', '2,700 li, ~54 caravan days', '380 li, ~8 caravan days'].map(
      (a) => ['/v1/route', 20_000n, a] as [string, bigint, string],
    ),
    ...['2,900 li, ~58 caravan days', '520 li, ~11 caravan days', '3,100 li, ~62 caravan days'].map(
      (a) => ['/v1/route', 20_000n, a] as [string, bigint, string],
    ),
    ['/v1/proverb', 5_000n, '“A journey of a thousand li begins with one step.”'],
    ['/v1/proverb', 5_000n, '“Tea is the pulse of the road.”'],
  ]
  const face = 300_000n
  const ev: DemoEvent[] = [
    { type: 'start', chain: 'illustration', chainName: 'a test network', explorer: '', face: face.toString() },
    {
      type: 'issued',
      certificateId: '',
      faceValue: face.toString(),
      expiresAt: '0',
      txHash: '',
      txUrl: '',
    },
  ]
  let cum = 0n
  let sinceCollect = 0n
  let down = false
  plan.forEach(([path, price, answer], i) => {
    cum += price
    sinceCollect += price
    ev.push({ type: 'sealed', cumulative: cum.toString(), requestId: `i${i}` })
    ev.push({
      type: 'accepted',
      path,
      price: price.toString(),
      status: 'SERVED',
      accepted: cum.toString(),
      consumed: cum.toString(),
      credit: '0',
    })
    ev.push({ type: 'step', text: `call → ${answer}` })
    const step = i + 1
    if (opts.cutNetwork && step === 5) {
      down = true
      ev.push({ type: 'network', down: true, text: '' })
      return
    }
    if (opts.cutNetwork && step === 12) {
      down = false
      ev.push({ type: 'network', down: false, text: '' })
      ev.push({ type: 'redeemed', paid: sinceCollect.toString(), cumulative: cum.toString(), txHash: '', txUrl: '' })
      sinceCollect = 0n
      return
    }
    if (!down && sinceCollect >= 100_000n) {
      ev.push({ type: 'redeemed', paid: sinceCollect.toString(), cumulative: cum.toString(), txHash: '', txUrl: '' })
      sinceCollect = 0n
    }
  })
  if (opts.stealKey) for (let i = 0; i < 3; i++) ev.push({ type: 'thief', attempt: '', refused: true, detail: '' })
  if (sinceCollect > 0n)
    ev.push({ type: 'redeemed', paid: sinceCollect.toString(), cumulative: cum.toString(), txHash: '', txUrl: '' })
  const redemptions = ev.filter((e) => e.type === 'redeemed').length
  ev.push({
    type: 'done',
    calls: plan.length,
    served: plan.length,
    consumed: cum.toString(),
    redeemed: cum.toString(),
    redemptions,
    remaining: (face - cum).toString(),
    certificateUrl: '',
  })
  return ev
}
