// The slip demo: our agent funds a tiny budget for the demo seller (the Oracle), signs one slip for it, and hands the
// slip to the visitor. The visitor carries it to any device, by any carrier, and spends it there. Test networks only;
// real transactions. The slip's key is made for this one slip and forgotten after signing.
import { getChain, isChainKey } from '@flying-money/chains'
import { encodeHeader, type Hex, newRequestId, signNote } from '@flying-money/core'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { encodeNoteCompact } from '@/lib/carry/codec'
import { FundError, fundDemoBudget } from '@/lib/demo-fund'
import { admitSlip, demoGuardFromEnv } from '@/lib/demo-guard'
import { SITE } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** One slip buys one 飛錢 certificate at the Oracle. */
const SLIP_PRICE = 10_000n // 0.01 USDC
/** Longer than the Oracle's minimum remaining lifetime (36 h), so the seller accepts it and collects in time. */
const LIFETIME_S = 3n * 86_400n

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { chain?: unknown }
  const chainKey = typeof body.chain === 'string' && isChainKey(body.chain) ? body.chain : 'arbitrum-sepolia'
  const chain = getChain(chainKey)
  if (chain.mainnet || !chain.flyingMoney || !process.env.DEMO_SLIP_FUNDER_KEY || !process.env.PAYEE_ADDRESS)
    return Response.json({ error: 'Slips are paused: the slip demo is not configured here.' }, { status: 503 })

  const guard = demoGuardFromEnv(process.env)
  if (!guard)
    return Response.json({ error: 'Slips are paused: the shared demo limits are not configured.' }, { status: 503 })
  const admission = await admitSlip(req, guard, SLIP_PRICE)
  if (!admission.ok) return Response.json({ error: admission.error }, { status: admission.status })

  const spender = privateKeyToAccount(generatePrivateKey())
  try {
    const funded = await fundDemoBudget({
      chainKey,
      face: SLIP_PRICE,
      payee: process.env.PAYEE_ADDRESS as Hex,
      spender: spender.address,
      lifetimeS: LIFETIME_S,
      guard,
    })
    const note = await signNote(spender, chain.chain.id, chain.flyingMoney, {
      certificateId: funded.id,
      cumulative: SLIP_PRICE,
      memo: newRequestId(),
    })
    return Response.json(
      {
        slip: encodeNoteCompact(note) ?? encodeHeader(note),
        chain: chainKey,
        chainName: chain.chain.name,
        certificateId: funded.id,
        issueTx: `${chain.explorer}/tx/${funded.tx}`,
        price: SLIP_PRICE.toString(),
        expiresAt: funded.expiresAt.toString(),
        seller: `${SITE.demoSeller.replace(/\/$/, '')}/v1/certificate`,
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    const f = e instanceof FundError ? e : new FundError((e as Error).message, 502)
    return Response.json({ error: f.message }, { status: f.status })
  }
}
