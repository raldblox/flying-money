// Live demo on a public TESTNET (§13): issue → Oracle (in-process, real HTTP) → Merchant → redeem.
// Used by the CLI (testnet-demo.ts) and the web /demo runner. Never fakes a transaction: every tx link is real.
import type { AddressInfo } from 'node:net'
import { flyingMoneyAbi } from '@flying-money/abi'
import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import { type ClientStore, createFlyingMoneyClient, memoryStore } from '@flying-money/client'
import { type Hex, readCertificate } from '@flying-money/core'
import { createOracle, type OracleEvent } from '@flying-money/oracle'
import { memoryStore as sellerMemoryStore } from '@flying-money/server'
import { serve } from '@hono/node-server'
import { createPublicClient, createWalletClient, erc20Abi, http, type LocalAccount, type PublicClient } from 'viem'
import { type MerchantResult, runMerchant } from './merchant.js'

export type LiveEvent =
  | { type: 'info'; text: string; url?: string }
  | { type: 'issued'; certificateId: Hex; faceValue: string; expiresAt: string; txHash: Hex; txUrl: string }
  | { type: 'step'; text: string }
  | { type: 'sealed'; cumulative: string; requestId: Hex }
  | {
      type: 'accepted'
      path: string
      price: string
      status: string
      accepted: string
      consumed: string
      credit: string
    }
  | { type: 'redeemed'; paid: string; cumulative: string; txHash: Hex; txUrl: string }
  | {
      type: 'done'
      calls: number
      served: number
      consumed: string
      redeemed: string
      redemptions: number
      remaining: string
      certificateUrl: string
      bestTrade?: MerchantResult['bestTrade']
    }
  | { type: 'error'; message: string }

export interface LiveDemoConfig {
  chain: ChainKey
  funder: LocalAccount
  agent: LocalAccount
  redeemer: LocalAccount
  payee: Hex
  faceValue: bigint
  env?: Record<string, string | undefined>
  /** Reuse an existing certificate instead of issuing a new one. */
  certificateId?: Hex
  agentStore?: ClientStore
  /**
   * 'http' (default): the Oracle listens on a local port and the agent calls it over real HTTP (CLI).
   * 'in-process': the agent calls the Oracle's fetch handler directly — same 402 / note / receipt flow, no socket.
   * Used by the web runner, where a localhost server inside a request handler is unreliable.
   */
  transport?: 'http' | 'in-process'
  onEvent: (e: LiveEvent) => void
}

export async function runLiveDemo(cfg: LiveDemoConfig): Promise<Extract<LiveEvent, { type: 'done' }>> {
  const chain = getChain(cfg.chain)
  if (chain.mainnet) throw new Error('the live demo runs on testnets only (mainnet needs explicit approval, §0.1)')
  if (!chain.flyingMoney) throw new Error(`no FlyingMoney deployment recorded for ${cfg.chain}`)
  const fmAddr = chain.flyingMoney
  const env = cfg.env ?? {}
  const emit = cfg.onEvent
  const transport = http(rpcUrl(cfg.chain, env))
  const pub = createPublicClient({ chain: chain.chain, transport, pollingInterval: 500 }) as PublicClient
  const txUrl = (h: Hex) => `${chain.explorer}/tx/${h}`

  // 1. Funder issues a certificate (7-day lifetime, D10).
  let id = cfg.certificateId
  if (!id) {
    const fw = createWalletClient({ account: cfg.funder, chain: chain.chain, transport })
    const allowance = await pub.readContract({
      address: chain.usdc,
      abi: erc20Abi,
      functionName: 'allowance',
      args: [cfg.funder.address, fmAddr],
    })
    if (allowance < cfg.faceValue) {
      const h = await fw.writeContract({
        address: chain.usdc,
        abi: erc20Abi,
        functionName: 'approve',
        args: [fmAddr, cfg.faceValue],
      })
      await pub.waitForTransactionReceipt({ hash: h })
      emit({ type: 'info', text: 'funder approved USDC', url: txUrl(h) })
    }
    const { timestamp } = await pub.getBlock()
    const expiresAt = timestamp + 7n * 86_400n
    const { result, request } = await pub.simulateContract({
      account: cfg.funder,
      address: fmAddr,
      abi: flyingMoneyAbi,
      functionName: 'issue',
      args: [cfg.payee, cfg.agent.address, cfg.faceValue, expiresAt],
    })
    const h = await fw.writeContract(request)
    const r = await pub.waitForTransactionReceipt({ hash: h })
    if (r.status !== 'success') throw new Error(`issue reverted: ${txUrl(h)}`)
    id = result
    emit({
      type: 'issued',
      certificateId: id,
      faceValue: cfg.faceValue.toString(),
      expiresAt: expiresAt.toString(),
      txHash: h,
      txUrl: txUrl(h),
    })
  }

  // 2. The Oracle, in-process over real HTTP, with its redeemer (demo policy: 0.10 USDC or 60 s).
  const oracle = createOracle({
    accepts: [cfg.chain],
    payee: cfg.payee,
    store: sellerMemoryStore(),
    env,
    redeemer: { account: cfg.redeemer, pollingIntervalMs: 500 },
  })
  let redemptions = 0
  oracle.events.on('note', (e: Extract<OracleEvent, { type: 'note' }>) =>
    emit({
      type: 'accepted',
      path: e.path,
      price: e.price,
      status: e.status,
      accepted: e.accepted,
      consumed: e.consumed,
      credit: e.credit,
    }),
  )
  oracle.events.on('redeemed', (e: Extract<OracleEvent, { type: 'redeemed' }>) => {
    redemptions++
    emit({ type: 'redeemed', paid: e.paid, cumulative: e.cumulative, txHash: e.txHash, txUrl: txUrl(e.txHash) })
  })
  oracle.events.on('error', (e: { message: string }) => emit({ type: 'info', text: `redeemer alert: ${e.message}` }))
  const inProcess = cfg.transport === 'in-process'
  const server = inProcess ? null : serve({ fetch: oracle.app.fetch, port: 0, hostname: '127.0.0.1' })
  try {
    let oracleUrl = 'http://oracle.internal'
    if (server) {
      await new Promise<void>((r) => (server.listening ? r() : server.once('listening', () => r())))
      oracleUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
    }

    // 3. The Merchant.
    const fm = createFlyingMoneyClient({
      chains: [cfg.chain],
      spender: cfg.agent,
      store: cfg.agentStore ?? memoryStore(),
      certificates: [id],
      maxPricePerRequest: 50_000n,
      env,
      ...(inProcess
        ? {
            fetch: ((u: RequestInfo | URL, init?: RequestInit) =>
              oracle.app.fetch(new Request(u, init))) as typeof fetch,
          }
        : {}),
      onEvent: (e) => {
        if (e.type === 'sealed') emit({ type: 'sealed', cumulative: e.cumulative.toString(), requestId: e.requestId })
      },
    })
    await fm.ready
    if (fm.status().length === 0) throw new Error('the agent cannot see the certificate (wrong spender or chain)')
    const merchant = await runMerchant({
      fm,
      oracleUrl,
      log: async (text) => {
        emit({ type: 'step', text })
        await oracle.redeemer?.tick()
      },
    })
    await oracle.redeemer?.tick({ force: true }) // "Redeem now"

    const c = (await readCertificate(pub, fmAddr, id))!
    const done = {
      type: 'done' as const,
      calls: merchant.calls,
      served: merchant.served,
      consumed: (fm.status()[0]?.consumed ?? 0n).toString(),
      redeemed: c.redeemed.toString(),
      redemptions,
      remaining: (c.faceValue - c.redeemed).toString(),
      certificateUrl: `/c/${cfg.chain}/${id}`,
      ...(merchant.bestTrade ? { bestTrade: merchant.bestTrade } : {}),
    }
    emit(done)
    return done
  } finally {
    server?.close()
  }
}
