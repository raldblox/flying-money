// The offline counter demo: funds the visitor's two earmarked budgets, one for the Tea House and one for tipping the
// staff, each payable only to its seller. They're handed to the visitor (on the page, or on their phone by a
// hand-over link); the visitor then pays with slips, even with the till's connection cut. Test networks only.
import { getChain, isChainKey } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { FundError, fundDemoBudget } from '@/lib/demo-fund'
import { admitSlip, demoGuardFromEnv } from '@/lib/demo-guard'
import { handOverFragment } from '@/lib/handover'
import { SITE } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Spending money for the shop shelf, and a little for tips. */
const SHOP_FACE = 100_000n // 0.10
const TIPS_FACE = 50_000n // 0.05
const LIFETIME_S = 3n * 86_400n

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { chain?: unknown }
  const chainKey = typeof body.chain === 'string' && isChainKey(body.chain) ? body.chain : 'arbitrum-sepolia'
  const chain = getChain(chainKey)
  if (chain.mainnet || !chain.flyingMoney || !process.env.DEMO_SLIP_FUNDER_KEY || !process.env.PAYEE_ADDRESS)
    return Response.json({ error: 'The counter demo is not configured here.' }, { status: 503 })
  const guard = demoGuardFromEnv(process.env)
  if (!guard) return Response.json({ error: 'The demo limits are not configured.' }, { status: 503 })
  const admission = await admitSlip(req, guard, SHOP_FACE + TIPS_FACE, 'counter')
  if (!admission.ok) return Response.json({ error: admission.error }, { status: admission.status })

  const shopPayee = process.env.PAYEE_ADDRESS as Hex
  const staffPayee = SITE.demoStaff
  try {
    const budgets = []
    for (const b of [
      { role: 'shop' as const, payee: shopPayee, face: SHOP_FACE, name: 'Tea House' },
      { role: 'tips' as const, payee: staffPayee, face: TIPS_FACE, name: 'Tips for Mei' },
    ]) {
      // each budget has its own spending key; it travels to the visitor inside the hand-over (the fragment of a link,
      // never sent to a server when opened)
      const key = generatePrivateKey()
      const funded = await fundDemoBudget({
        chainKey,
        face: b.face,
        payee: b.payee,
        spender: privateKeyToAccount(key).address,
        lifetimeS: LIFETIME_S,
        guard,
      })
      budgets.push({
        role: b.role,
        name: b.name,
        certificateId: funded.id,
        payee: b.payee,
        face: b.face.toString(),
        expiresAt: funded.expiresAt.toString(),
        issueTx: `${chain.explorer}/tx/${funded.tx}`,
        handOver: handOverFragment({ v: 1, chain: chainKey, id: funded.id, key, name: b.name }),
      })
    }
    return Response.json(
      { chain: chainKey, chainName: chain.chain.name, contract: chain.flyingMoney, budgets },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    const f = e instanceof FundError ? e : new FundError((e as Error).message, 502)
    return Response.json({ error: f.message }, { status: f.status })
  }
}
