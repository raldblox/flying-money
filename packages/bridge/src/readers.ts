import { type ChainKey, getChain, rpcTransport } from '@flying-money/chains'
import type { Hex } from '@flying-money/core'
import { createPublicClient, erc20Abi } from 'viem'
import type { Ledger } from './ledger.js'

/** Balance readers for the bridge wallet, keyed by CAIP-2 network ("eip155:8453"): USDC and the fee token. */
export function chainReaders(chains: ChainKey[], wallet: Hex, env: Record<string, string | undefined>) {
  const usdc = new Map<string, () => Promise<bigint>>()
  const gas = new Map<string, () => Promise<bigint>>()
  for (const k of chains) {
    const c = getChain(k)
    const pub = createPublicClient({ chain: c.chain, transport: rpcTransport(k, env) })
    const id = `eip155:${c.chain.id}`
    usdc.set(id, () => pub.readContract({ address: c.usdc, abi: erc20Abi, functionName: 'balanceOf', args: [wallet] }))
    gas.set(id, () => pub.getBalance({ address: wallet }))
  }
  return {
    usdc: async (network: string) => (await usdc.get(network)?.()) ?? 0n,
    gas: async (network: string) => (await gas.get(network)?.()) ?? 0n,
  }
}

/**
 * Writes a collection to the activity log with what it cost (execution gas plus, on a rollup, the fee for posting it to
 * Ethereum), read from the transaction's receipt. A receipt that can't be read still logs the collection, without a cost.
 */
export async function logCollection(
  ledger: Ledger,
  chains: ChainKey[],
  env: Record<string, string | undefined>,
  e: { chainId: number; paid: bigint; txHash: Hex },
): Promise<void> {
  const entry = {
    at: Date.now(),
    kind: 'collected' as const,
    network: `eip155:${e.chainId}`,
    amount: e.paid.toString(),
    tx: e.txHash,
  }
  const key = chains.find((k) => getChain(k).chain.id === e.chainId)
  if (!key) return void (await ledger.add(entry))
  try {
    const pub = createPublicClient({ chain: getChain(key).chain, transport: rpcTransport(key, env) })
    const r = await pub.getTransactionReceipt({ hash: e.txHash })
    const l1 = (r as unknown as { l1Fee?: bigint }).l1Fee ?? 0n
    await ledger.add({ ...entry, gas: (r.gasUsed * r.effectiveGasPrice + l1).toString() })
  } catch {
    await ledger.add(entry)
  }
}
