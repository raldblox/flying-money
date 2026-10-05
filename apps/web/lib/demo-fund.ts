import { flyingMoneyAbi } from '@flying-money/abi'
import { keyFromEnv } from '@flying-money/agent'
import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { createPublicClient, createWalletClient, erc20Abi, http, maxUint256, parseEventLogs } from 'viem'
import type { DemoGuardDeps } from './demo-guard'

/** A visitor-facing reason the demo couldn't fund a budget, with the HTTP status to answer. */
export class FundError extends Error {
  constructor(
    message: string,
    public status: 429 | 502 | 503,
  ) {
    super(message)
  }
}

const LOCK_MS = 60_000

/** The slip demos' funder (testnet only): its address, so collection can check a budget really is a demo budget. */
export const demoFunderAddress = () => keyFromEnv('DEMO_SLIP_FUNDER_KEY').address

/**
 * Funds one demo budget from the slip demos' funder: `face` test USDC for `payee`, spendable by `spender`, for
 * `lifetimeS` seconds. One funder means one nonce sequence per network, so funding is serialised per network.
 * Right after a network's first approval, a load-balanced RPC may estimate gas on a node that hasn't seen it yet: the
 * issue is retried for a few seconds.
 */
export async function fundDemoBudget(o: {
  chainKey: ChainKey
  face: bigint
  payee: Hex
  spender: Hex
  lifetimeS: bigint
  guard: DemoGuardDeps
  env?: Record<string, string | undefined>
}): Promise<{ id: Hex; tx: Hex; expiresAt: bigint }> {
  const chain = getChain(o.chainKey)
  if (chain.mainnet || !chain.flyingMoney) throw new FundError('Demos run on test networks only.', 503)
  const contract = chain.flyingMoney
  let token: string | null = null
  for (let i = 0; i < 20 && !token; i++) {
    token = await o.guard.lock.acquire(`slip:${o.chainKey}`, LOCK_MS)
    if (!token) await new Promise((r) => setTimeout(r, 1000))
  }
  if (!token) throw new FundError('Lots of visitors right now. Try again in a moment.', 429)

  const funder = keyFromEnv('DEMO_SLIP_FUNDER_KEY', o.env)
  const transport = http(rpcUrl(o.chainKey, o.env ?? process.env))
  const pub = createPublicClient({ chain: chain.chain, transport })
  const wallet = createWalletClient({ account: funder, chain: chain.chain, transport })
  try {
    const held = await pub.readContract({
      address: chain.usdc,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [funder.address],
    })
    if (held < o.face)
      throw new FundError(`The demo wallet on ${chain.chain.name} is out of test money. Try another network.`, 503)
    const approvedNow =
      (await pub.readContract({
        address: chain.usdc,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [funder.address, contract],
      })) < o.face
    if (approvedNow) {
      const a = await wallet.writeContract({
        address: chain.usdc,
        abi: erc20Abi,
        functionName: 'approve',
        args: [contract, maxUint256],
      })
      await pub.waitForTransactionReceipt({ hash: a })
    }
    const expiresAt = BigInt(Math.floor(Date.now() / 1000)) + o.lifetimeS
    let tx: Hex | undefined
    for (let attempt = 0; !tx; attempt++) {
      try {
        tx = await wallet.writeContract({
          address: contract,
          abi: flyingMoneyAbi,
          functionName: 'issue',
          args: [o.payee, o.spender, o.face, expiresAt],
        })
      } catch (e) {
        if (!approvedNow || attempt >= 4) throw e
        await new Promise((r) => setTimeout(r, 2000))
      }
    }
    const receipt = await pub.waitForTransactionReceipt({ hash: tx })
    const [ev] = parseEventLogs({ abi: flyingMoneyAbi, logs: receipt.logs, eventName: 'CertificateIssued' })
    if (!ev) throw new FundError('The budget was not created. Try again.', 502)
    return { id: ev.args.id, tx, expiresAt }
  } catch (e) {
    if (e instanceof FundError) throw e
    throw new FundError(`Couldn’t fund it: ${(e as Error).message.split('\n')[0]}`, 502)
  } finally {
    await o.guard.lock.release(`slip:${o.chainKey}`, token).catch(() => {})
  }
}
