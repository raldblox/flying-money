// The offline counter demo, step 4: the demo till is back online and collects what it accepted, in one transaction.
// Only for demo budgets (funded by the demo wallet, paying the demo shop or its staff); the money goes to their addresses.
import { flyingMoneyAbi } from '@flying-money/abi'
import { keyFromEnv } from '@flying-money/agent'
import { getChain, isChainKey, rpcUrl } from '@flying-money/chains'
import { decodeNote, type Hex, readCertificate } from '@flying-money/core'
import { createPublicClient, createWalletClient, http, isAddressEqual, parseEventLogs } from 'viem'
import { demoFunderAddress } from '@/lib/demo-fund'
import { demoGuardFromEnv } from '@/lib/demo-guard'
import { SITE } from '@/lib/site'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const MAX_NOTES = 20

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as { chain?: unknown; notes?: unknown }
  const chainKey = typeof body.chain === 'string' && isChainKey(body.chain) ? body.chain : null
  const raw = Array.isArray(body.notes) ? body.notes.filter((n): n is string => typeof n === 'string') : []
  if (!chainKey || raw.length === 0 || raw.length > MAX_NOTES)
    return Response.json({ error: 'Send the network and up to 20 slips.' }, { status: 400 })
  const chain = getChain(chainKey)
  if (chain.mainnet || !chain.flyingMoney || !process.env.REDEEMER_KEY || !process.env.PAYEE_ADDRESS)
    return Response.json({ error: 'Collecting is not configured here.' }, { status: 503 })
  const guard = demoGuardFromEnv(process.env)
  if (!guard) return Response.json({ error: 'The demo limits are not configured.' }, { status: 503 })
  const ip = req.headers.get('x-real-ip') ?? (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0]!.trim()
  if (!(await guard.limits.hit('counter-collect', ip, 3, 60)).ok)
    return Response.json({ error: 'A few collections a minute at most. Try again shortly.' }, { status: 429 })

  const transport = http(rpcUrl(chainKey, process.env))
  const pub = createPublicClient({ chain: chain.chain, transport })
  // the demo's two sellers: the Tea House and Mei, its staff member (tips)
  const payees = [process.env.PAYEE_ADDRESS as Hex, SITE.demoStaff]
  const funder = demoFunderAddress()
  const items = []
  for (const r of raw) {
    let n: ReturnType<typeof decodeNote>
    try {
      n = decodeNote(r)
    } catch {
      return Response.json({ error: 'One of the slips is malformed.' }, { status: 400 })
    }
    if (n.chainId !== chain.chain.id) return Response.json({ error: 'A slip is for another network.' }, { status: 400 })
    const c = await readCertificate(pub, chain.flyingMoney, n.certificateId)
    if (!c || !isAddressEqual(c.funder, funder) || !payees.some((p) => isAddressEqual(c.payee, p)))
      return Response.json({ error: 'Only demo budgets can be collected here.' }, { status: 403 })
    if (n.cumulative <= c.redeemed) continue // already collected
    items.push({ certificateId: n.certificateId, cumulative: n.cumulative, memo: n.memo, signature: n.sig })
  }
  if (items.length === 0) return Response.json({ collected: 0, note: 'Everything here was already collected.' })

  try {
    const redeemer = keyFromEnv('REDEEMER_KEY')
    const wallet = createWalletClient({ account: redeemer, chain: chain.chain, transport })
    const { request } = await pub.simulateContract({
      account: redeemer,
      address: chain.flyingMoney,
      abi: flyingMoneyAbi,
      functionName: 'redeemMany',
      args: [items],
    })
    const tx = await wallet.writeContract(request)
    const receipt = await pub.waitForTransactionReceipt({ hash: tx })
    if (receipt.status !== 'success') throw new Error('Collection transaction reverted.')
    const collected = parseEventLogs({ abi: flyingMoneyAbi, logs: receipt.logs, eventName: 'NoteRedeemed' }).filter(
      (log) => isAddressEqual(log.address, chain.flyingMoney!),
    ).length
    return Response.json({ collected, tx: `${chain.explorer}/tx/${tx}`, hash: tx })
  } catch (e) {
    return Response.json({ error: `Couldn’t collect: ${(e as Error).message.split('\n')[0]}` }, { status: 502 })
  }
}
