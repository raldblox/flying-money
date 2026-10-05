// The offline counter demo: funds a small budget for the demo till and hands it to the visitor's phone wallet (a
// hand-over link, like a gift). The phone then pays the till with slips, even in airplane mode. Test networks only.
import { getChain, isChainKey } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { FundError, fundDemoBudget } from '@/lib/demo-fund'
import { admitSlip, demoGuardFromEnv } from '@/lib/demo-guard'
import { handOverFragment } from '@/lib/handover'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Enough for five 0.01 certificates. */
const FACE = 50_000n
const LIFETIME_S = 3n * 86_400n

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { chain?: unknown }
  const chainKey = typeof body.chain === 'string' && isChainKey(body.chain) ? body.chain : 'arbitrum-sepolia'
  const chain = getChain(chainKey)
  if (chain.mainnet || !chain.flyingMoney || !process.env.DEMO_SLIP_FUNDER_KEY || !process.env.PAYEE_ADDRESS)
    return Response.json({ error: 'The counter demo is not configured here.' }, { status: 503 })
  const guard = demoGuardFromEnv(process.env)
  if (!guard) return Response.json({ error: 'The demo limits are not configured.' }, { status: 503 })
  const admission = await admitSlip(req, guard, FACE, 'counter')
  if (!admission.ok) return Response.json({ error: admission.error }, { status: admission.status })

  // the phone's own spending key travels to it inside the hand-over link (the fragment, never sent to a server)
  const key = generatePrivateKey()
  try {
    const funded = await fundDemoBudget({
      chainKey,
      face: FACE,
      payee: process.env.PAYEE_ADDRESS as Hex,
      spender: privateKeyToAccount(key).address,
      lifetimeS: LIFETIME_S,
      guard,
    })
    return Response.json(
      {
        chain: chainKey,
        chainName: chain.chain.name,
        certificateId: funded.id,
        issueTx: `${chain.explorer}/tx/${funded.tx}`,
        face: FACE.toString(),
        handOver: handOverFragment({ v: 1, chain: chainKey, id: funded.id, key, name: 'Flying Money tea house' }),
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    const f = e instanceof FundError ? e : new FundError((e as Error).message, 502)
    return Response.json({ error: f.message }, { status: f.status })
  }
}
