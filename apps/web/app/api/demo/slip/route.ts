// The slip demo: our agent funds a tiny budget for the demo seller (the Oracle), signs one slip for it, and hands the
// slip to the visitor. The visitor carries it to any device, by any carrier, and spends it there. Test networks only;
// real transactions. The slip's key is made for this one slip and forgotten after signing.
import { flyingMoneyAbi } from '@flying-money/abi'
import { keyFromEnv } from '@flying-money/agent'
import { getChain, isChainKey, rpcUrl } from '@flying-money/chains'
import { encodeHeader, type Hex, newRequestId, signNote } from '@flying-money/core'
import { createPublicClient, createWalletClient, erc20Abi, http, maxUint256, parseEventLogs } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { encodeNoteCompact } from '@/lib/carry/codec'
import { admitSlip, demoGuardFromEnv } from '@/lib/demo-guard'
import { SITE } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** One slip buys one 飛錢 certificate at the Oracle. */
const SLIP_PRICE = 10_000n // 0.01 USDC
/** Longer than the Oracle's minimum remaining lifetime (36 h), so the seller accepts it and collects in time. */
const LIFETIME_S = 3n * 86_400n
const LOCK_MS = 60_000

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

  // one funder, one nonce sequence per network: fund one slip at a time
  let token: string | null = null
  for (let i = 0; i < 20 && !token; i++) {
    token = await guard.lock.acquire(`slip:${chainKey}`, LOCK_MS)
    if (!token) await new Promise((r) => setTimeout(r, 1000))
  }
  if (!token) return Response.json({ error: 'Lots of slips right now. Try again in a moment.' }, { status: 429 })

  const funder = keyFromEnv('DEMO_SLIP_FUNDER_KEY')
  const payee = process.env.PAYEE_ADDRESS as Hex
  const transport = http(rpcUrl(chainKey, process.env))
  const pub = createPublicClient({ chain: chain.chain, transport })
  const wallet = createWalletClient({ account: funder, chain: chain.chain, transport })
  const spender = privateKeyToAccount(generatePrivateKey())
  try {
    const held = await pub.readContract({
      address: chain.usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [funder.address],
    })
    if (held < SLIP_PRICE)
      return Response.json(
        { error: `The slip wallet on ${chain.chain.name} is out of test money. Try another network.` },
        { status: 503 },
      )
    const allowed = await pub.readContract({
      address: chain.usdc,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [funder.address, chain.flyingMoney],
    })
    if (allowed < SLIP_PRICE) {
      const a = await wallet.writeContract({
        address: chain.usdc,
        abi: erc20Abi,
        functionName: 'approve',
        args: [chain.flyingMoney, maxUint256],
      })
      await pub.waitForTransactionReceipt({ hash: a })
    }
    const expiresAt = BigInt(Math.floor(Date.now() / 1000)) + LIFETIME_S
    const tx = await wallet.writeContract({
      address: chain.flyingMoney,
      abi: flyingMoneyAbi,
      functionName: 'issue',
      args: [payee, spender.address, SLIP_PRICE, expiresAt],
    })
    const receipt = await pub.waitForTransactionReceipt({ hash: tx })
    const [ev] = parseEventLogs({ abi: flyingMoneyAbi, logs: receipt.logs, eventName: 'CertificateIssued' })
    if (!ev) throw new Error('the budget was not created')
    const note = await signNote(spender, chain.chain.id, chain.flyingMoney, {
      certificateId: ev.args.id,
      cumulative: SLIP_PRICE,
      memo: newRequestId(),
    })
    return Response.json(
      {
        slip: encodeNoteCompact(note) ?? encodeHeader(note),
        chain: chainKey,
        chainName: chain.chain.name,
        certificateId: ev.args.id,
        issueTx: `${chain.explorer}/tx/${tx}`,
        price: SLIP_PRICE.toString(),
        expiresAt: expiresAt.toString(),
        seller: `${SITE.demoSeller.replace(/\/$/, '')}/v1/certificate`,
      },
      { headers: { 'cache-control': 'no-store' } },
    )
  } catch (e) {
    return Response.json({ error: `Couldn’t fund a slip: ${(e as Error).message.split('\n')[0]}` }, { status: 502 })
  } finally {
    await guard.lock.release(`slip:${chainKey}`, token).catch(() => {})
  }
}
