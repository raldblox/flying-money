// Demo runner (§13.3): runs the live testnet demo server-side with the runner's keys and streams events as NDJSON.
// Never fakes transactions: if the chain or the runner isn't available, it says so.
import { keyFromEnv, type LiveEvent, runLiveDemo } from '@flying-money/agent'
import { getChain, isChainKey } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const RUN_TIMEOUT_MS = 240_000 // a hung run must never hold the lock
const FACE = 300_000n // 0.30 USDC per run (20 calls cost 0.25)
const PER_IP_MS = 2 * 60_000 // §13.3: 1 run per IP per 2 minutes
const lastRun = new Map<string, number>()
let running = false // one run at a time: parallel runs would race the funder's nonce

function configured() {
  return ['DEMO_FUNDER_KEY', 'DEMO_AGENT_KEY', 'REDEEMER_KEY', 'PAYEE_ADDRESS'].every((k) => process.env[k])
}

export async function POST(req: Request) {
  const chainKey = process.env.NEXT_PUBLIC_DEFAULT_CHAIN ?? 'arbitrum-sepolia'
  if (!isChainKey(chainKey) || getChain(chainKey).mainnet || !getChain(chainKey).flyingMoney || !configured())
    return Response.json(
      { error: 'Demo paused: the demo runner is not configured on this deployment.' },
      { status: 503 },
    )

  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0]!.trim()
  const last = lastRun.get(ip) ?? 0
  if (Date.now() - last < PER_IP_MS)
    return Response.json(
      {
        error: `One run per visitor every 2 minutes. Try again in ${Math.ceil((PER_IP_MS - (Date.now() - last)) / 1000)} s.`,
      },
      { status: 429 },
    )
  if (running)
    return Response.json({ error: 'Another visitor’s demo is running. Try again in a minute.' }, { status: 429 })
  running = true
  lastRun.set(ip, Date.now())

  const enc = new TextEncoder()
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (
        e: LiveEvent | { type: 'start'; chain: string; chainName: string; explorer: string; face: string },
      ) => controller.enqueue(enc.encode(`${JSON.stringify(e)}\n`))
      try {
        const chain = getChain(chainKey)
        send({
          type: 'start',
          chain: chainKey,
          chainName: chain.chain.name,
          explorer: chain.explorer,
          face: FACE.toString(),
        })
        let timer: ReturnType<typeof setTimeout> | undefined
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('the run took too long (RPC or chain slow); try again')),
            RUN_TIMEOUT_MS,
          )
        })
        await Promise.race([
          timeout,
          runLiveDemo({
            chain: chainKey,
            funder: keyFromEnv('DEMO_FUNDER_KEY'),
            agent: keyFromEnv('DEMO_AGENT_KEY'),
            redeemer: keyFromEnv('REDEEMER_KEY'),
            payee: process.env.PAYEE_ADDRESS as Hex,
            faceValue: FACE,
            env: process.env,
            transport: 'in-process',
            onEvent: send,
          }),
        ]).finally(() => clearTimeout(timer))
      } catch (e) {
        send({ type: 'error', message: `Demo paused: ${(e as Error).message.split('\n')[0]}` })
      } finally {
        running = false
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  })
}
