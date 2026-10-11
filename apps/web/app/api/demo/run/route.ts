import '@/lib/e2e'
// Demo runner: starts background testnet purchases and retains reconnectable public event records.
// Never fakes transactions: if the chain or the runner isn't available, it says so.
import { keyFromEnv, runLiveDemo } from '@flying-money/agent'
import { getChain, isChainKey, rpcUrl } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { after } from 'next/server'
import { createPublicClient, erc20Abi, http } from 'viem'
import { admitDemoRun, demoGuardFromEnv, inspectDemoRun } from '@/lib/demo-guard'
import { demoRunsFromEnv, validRunId } from '@/lib/demo-runs'
import type { DemoEvent } from '@/lib/demo-story'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// Keep the hosted execution lifetime below the shared guard lock (270 seconds).
export const maxDuration = 240

const FACE = 300_000n // 0.30 USDC per run (19 purchases cost 0.25)

function configured() {
  return ['DEMO_FUNDER_KEY', 'DEMO_AGENT_KEY', 'REDEEMER_KEY', 'PAYEE_ADDRESS'].every((k) => process.env[k])
}

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams
  const headers = { 'cache-control': 'no-store' }
  try {
    if (query.has('runId')) {
      const id = query.get('runId')
      if (!validRunId(id)) return Response.json({ error: 'Invalid run ID' }, { status: 400, headers })
      const run = await demoRunsFromEnv(process.env)?.read(id)
      return run
        ? Response.json(run, { headers })
        : Response.json(
            {
              error: 'This run is unavailable or its 24-hour record has expired. Starting again creates a new budget.',
            },
            { status: 404, headers },
          )
    }
    const key = query.get('chain') ?? ''
    const guard = demoGuardFromEnv(process.env)
    if (
      !isChainKey(key) ||
      getChain(key).mainnet ||
      !getChain(key).flyingMoney ||
      !configured() ||
      !guard ||
      !demoRunsFromEnv(process.env)
    )
      return Response.json(
        {
          available: false,
          reason: 'unavailable',
          message: 'The sponsored agent is unavailable on this network. The preview on this page still plays.',
        },
        { headers },
      )
    const admission = await inspectDemoRun(req, guard, FACE)
    if (!admission.available) return Response.json(admission, { headers })
    const chain = getChain(key)
    const pub = createPublicClient({
      chain: chain.chain,
      transport: http(rpcUrl(key, process.env), { timeout: 8000, retryCount: 0 }),
    })
    const held = await pub.readContract({
      address: chain.usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [keyFromEnv('DEMO_FUNDER_KEY').address],
    })
    const [setupGas, collectionGas] = await Promise.all([
      pub.getBalance({ address: keyFromEnv('DEMO_FUNDER_KEY').address }),
      pub.getBalance({ address: keyFromEnv('REDEEMER_KEY').address }),
    ])
    if (setupGas === 0n || collectionGas === 0n)
      return Response.json(
        {
          available: false,
          reason: 'unfunded',
          message:
            'The sponsor needs more test-network gas for setup or collection. You pay no gas yourself. Choose another network. The preview on this page still plays.',
        },
        { headers },
      )
    return Response.json(
      held >= FACE
        ? admission
        : {
            available: false,
            reason: 'unfunded',
            message:
              'The sponsor needs more test funds on this network. Choose another network. The preview on this page still plays.',
          },
      { headers },
    )
  } catch {
    return Response.json(
      {
        available: false,
        reason: 'unavailable',
        message: 'We could not check sponsorship right now. Please check again in a moment.',
      },
      { headers },
    )
  }
}

export async function POST(req: Request) {
  // §13.3 scenario toggles (D22) and the chain (?chain=, §21.2): chosen before the run
  const body = (await req.json().catch(() => ({}))) as {
    chain?: unknown
    cutNetwork?: unknown
    stealKey?: unknown
    runId?: unknown
  }
  if (!validRunId(body.runId)) return Response.json({ error: 'A valid run ID is required.' }, { status: 400 })
  const runId = body.runId
  const records = demoRunsFromEnv(process.env)
  if (!records) return Response.json({ error: 'Recoverable demo storage is unavailable.' }, { status: 503 })
  // The opaque ID is the read capability. There is no public listing of visitor runs.
  const existing = await records.read(runId)
  if (existing) return Response.json({ runId }, { headers: { 'cache-control': 'no-store' } })
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

  // Every deployed testnet is offered, but the demo wallet may not hold test money on each one yet: say so before
  // taking the visitor's run slot, instead of failing halfway through a run.
  const chain = getChain(chainKey)
  try {
    const funder = keyFromEnv('DEMO_FUNDER_KEY').address
    const pub = createPublicClient({ chain: chain.chain, transport: http(rpcUrl(chainKey, process.env)) })
    const held = await pub.readContract({
      address: chain.usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [funder],
    })
    if (held < FACE) {
      const fallback = getChain(
        isChainKey(process.env.NEXT_PUBLIC_DEFAULT_CHAIN ?? '')
          ? (process.env.NEXT_PUBLIC_DEFAULT_CHAIN as never)
          : 'arbitrum-sepolia',
      )
      return Response.json(
        {
          error: `The demo wallet on ${chain.chain.name} has no test money yet. ${chainKey === fallback.key ? 'Try again later.' : `Try ${fallback.chain.name}.`}`,
        },
        { status: 503 },
      )
    }
  } catch {
    // a slow RPC here shouldn't block the run; the run itself reports real failures
  }

  // F9 (D28): limits shared by every instance (Upstash), same-origin only, one run at a time, a daily USDC cap
  const guard = demoGuardFromEnv(process.env)
  if (!guard)
    return Response.json({ error: 'Demo paused: the shared demo limits are not configured.' }, { status: 503 })
  const admission = await admitDemoRun(req, guard, FACE)
  if (!admission.ok) return Response.json({ error: admission.error }, { status: admission.status })

  try {
    if (!(await records.create(runId))) {
      await admission.release()
      return Response.json({ runId }, { headers: { 'cache-control': 'no-store' } })
    }
    await records.append(runId, {
      type: 'start',
      chain: chainKey,
      chainName: chain.chain.name,
      explorer: chain.explorer,
      face: FACE.toString(),
    })
  } catch {
    await admission.release()
    return Response.json({ error: 'Could not save a recoverable run. No purchases were started.' }, { status: 503 })
  }
  // Next keeps this work alive after the response, including when the visitor refreshes or disconnects.
  // Events contain public payment evidence and Oracle answers, never private keys or signed bearer handovers.
  after(async () => {
    let writes = Promise.resolve()
    const send = (event: DemoEvent) => {
      writes = writes.then(() => records.append(runId, event))
      void writes.catch(() => {})
    }
    try {
      await runLiveDemo({
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
      })
      await writes
    } catch (error) {
      await writes.catch(() => {})
      await records
        .append(runId, { type: 'error', message: `Demo paused: ${(error as Error).message.split('\n')[0]}` })
        .catch(() => {})
    } finally {
      await admission.release().catch(() => {})
    }
  })
  return Response.json({ runId }, { status: 202, headers: { 'cache-control': 'no-store' } })
}
