// Demo runner (§13.3): runs the live testnet demo server-side with the runner's keys and streams events as NDJSON.
// Never fakes transactions: if the chain or the runner isn't available, it says so.
import { keyFromEnv, type LiveEvent, runLiveDemo } from '@flying-money/agent'
import { getChain, isChainKey } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { admitDemoRun, demoGuardFromEnv } from '@/lib/demo-guard'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 300

const RUN_TIMEOUT_MS = 240_000 // a hung run must never hold the lock
const FACE = 300_000n // 0.30 USDC per run (20 calls cost 0.25)

function configured() {
  return ['DEMO_FUNDER_KEY', 'DEMO_AGENT_KEY', 'REDEEMER_KEY', 'PAYEE_ADDRESS'].every((k) => process.env[k])
}

export async function POST(req: Request) {
  // §13.3 scenario toggles (D22) and the chain (?chain=, §21.2): chosen before the run
  const body = (await req.json().catch(() => ({}))) as { chain?: unknown; cutNetwork?: unknown; stealKey?: unknown }
  const scenarios = { cutNetwork: body.cutNetwork === true, stealKey: body.stealKey === true }
  const chainKey =
    typeof body.chain === 'string' && isChainKey(body.chain)
      ? body.chain
      : (process.env.NEXT_PUBLIC_DEFAULT_CHAIN ?? 'arbitrum-sepolia')
  if (!isChainKey(chainKey) || getChain(chainKey).mainnet || !getChain(chainKey).flyingMoney || !configured())
    return Response.json(
      { error: 'Demo paused: the demo runner is not configured on this deployment.' },
      { status: 503 },
    )

  // F9 (D28): limits shared by every instance (Upstash), same-origin only, one run at a time, a daily USDC cap
  const guard = demoGuardFromEnv(process.env)
  if (!guard)
    return Response.json({ error: 'Demo paused: the shared demo limits are not configured.' }, { status: 503 })
  const admission = await admitDemoRun(req, guard, FACE)
  if (!admission.ok) return Response.json({ error: admission.error }, { status: admission.status })

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
            scenarios,
            onEvent: send,
          }),
        ]).finally(() => clearTimeout(timer))
      } catch (e) {
        send({ type: 'error', message: `Demo paused: ${(e as Error).message.split('\n')[0]}` })
      } finally {
        await admission.release().catch(() => {})
        controller.close()
      }
    },
  })
  return new Response(stream, {
    headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' },
  })
}
