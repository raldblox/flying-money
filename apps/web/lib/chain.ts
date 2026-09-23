import { flyingMoneyAbi } from '@flying-money/abi'
import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import { type Certificate, type Hex, readCertificate } from '@flying-money/core'
import { createPublicClient, http, type PublicClient } from 'viem'
import { E2E, e2eMode } from './e2e'

const clients = new Map<ChainKey, PublicClient>()
export function publicClient(key: ChainKey): PublicClient {
  let c = clients.get(key)
  if (!c) {
    c = createPublicClient({
      chain: getChain(key).chain,
      transport: http(e2eMode && key === 'anvil' ? E2E.rpc : rpcUrl(key, process.env)),
    }) as PublicClient
    clients.set(key, c)
  }
  return c
}

export async function loadCertificate(key: ChainKey, id: Hex): Promise<Certificate | null> {
  const ch = getChain(key)
  if (!ch.flyingMoney) return null
  return readCertificate(publicClient(key), ch.flyingMoney, id)
}

export interface TimelineEvent {
  kind: 'Issued' | 'Topped up' | 'Extended' | 'Redeemed' | 'Reclaimed'
  blockNumber: bigint
  txHash: Hex
  detail: Record<string, bigint | string>
}

/** Every event for one certificate (the id is an indexed topic, so the RPC filters server-side). */
export async function certificateTimeline(key: ChainKey, id: Hex): Promise<TimelineEvent[]> {
  const ch = getChain(key)
  if (!ch.flyingMoney) return []
  const client = publicClient(key)
  const fromBlock = ch.deployedBlock ?? 0n
  const q = { address: ch.flyingMoney, abi: flyingMoneyAbi, fromBlock, args: { id } } as const
  const [issued, topped, extended, redeemed, reclaimed] = await Promise.all([
    client.getContractEvents({ ...q, eventName: 'CertificateIssued' }),
    client.getContractEvents({ ...q, eventName: 'CertificateToppedUp' }),
    client.getContractEvents({ ...q, eventName: 'CertificateExtended' }),
    client.getContractEvents({ ...q, eventName: 'NoteRedeemed' }),
    client.getContractEvents({ ...q, eventName: 'CertificateReclaimed' }),
  ])
  const out: TimelineEvent[] = [
    ...issued.map((l) => ({
      kind: 'Issued' as const,
      l,
      detail: { faceValue: l.args.faceValue!, expiresAt: BigInt(l.args.expiresAt!) },
    })),
    ...topped.map((l) => ({
      kind: 'Topped up' as const,
      l,
      detail: { amount: l.args.amount!, newFaceValue: l.args.newFaceValue! },
    })),
    ...extended.map((l) => ({ kind: 'Extended' as const, l, detail: { newExpiresAt: BigInt(l.args.newExpiresAt!) } })),
    ...redeemed.map((l) => ({
      kind: 'Redeemed' as const,
      l,
      detail: { paid: l.args.paid!, cumulative: l.args.cumulative!, redeemer: l.args.redeemer! },
    })),
    ...reclaimed.map((l) => ({ kind: 'Reclaimed' as const, l, detail: { refunded: l.args.refunded! } })),
  ].map(({ kind, l, detail }) => ({ kind, blockNumber: l.blockNumber, txHash: l.transactionHash, detail }))
  return out.sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : 0))
}
