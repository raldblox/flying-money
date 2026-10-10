// Live demo on a public TESTNET (§13): issue → Oracle (in-process, real HTTP) → Merchant → redeem.
// Used by the CLI (testnet-demo.ts) and the web /demo runner. Never fakes a transaction: every tx link is real.
import type { AddressInfo } from 'node:net'
import { flyingMoneyAbi } from '@flying-money/abi'
import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import { type ClientStore, createFlyingMoneyClient, memoryStore } from '@flying-money/client'
import { encodeHeader, type Hex, NOTE_HEADER, newRequestId, readCertificate, signNote } from '@flying-money/core'
import { createOracle, type OracleConfig, type OracleEvent } from '@flying-money/oracle'
import { memoryStore as sellerMemoryStore } from '@flying-money/server'
import { serve } from '@hono/node-server'
import {
  BaseError,
  ContractFunctionRevertedError,
  createPublicClient,
  createWalletClient,
  erc20Abi,
  formatUnits,
  http,
  type LocalAccount,
  type PublicClient,
} from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { type MerchantAnswer, type MerchantResult, runMerchant } from './merchant.js'

export type LiveEvent =
  | ({ type: 'answer' } & MerchantAnswer)
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
  | { type: 'network'; down: boolean; text: string }
  | { type: 'thief'; attempt: string; refused: boolean; detail: string }
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
  /**
   * §13.3 scenarios, performed live during the run (DECISIONS D22):
   * - cutNetwork: the seller's chain connection fails for part of the run; notes keep being accepted from its
   *   cache, redemption waits, and one transaction collects everything after the restore.
   * - stealKey: after the run, a thief holding the agent key tries to overspend, to make the contract pay more,
   *   and to pay a different seller. Every attempt is a real check (off-chain seller logic or an eth_call).
   */
  scenarios?: { cutNetwork?: boolean; stealKey?: boolean }
  /** Tests only: replace the Open-Meteo call. */
  fetchWeather?: OracleConfig['fetchWeather']
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
  let networkDown = false
  const oracle = createOracle({
    accepts: [cfg.chain],
    payee: cfg.payee,
    store: sellerMemoryStore(),
    env,
    // the seller's view of the chain; "Cut the network" makes it fail (the seller keeps its cache)
    readCertificate: (_chainId, contract, cid) => {
      if (networkDown) return Promise.reject(new Error('seller RPC unreachable (Cut the network)'))
      return readCertificate(pub, contract, cid)
    },
    redeemer: { account: cfg.redeemer, pollingIntervalMs: 500 },
    ...(cfg.fetchWeather ? { fetchWeather: cfg.fetchWeather } : {}),
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
    let step = 0
    const cut = cfg.scenarios?.cutNetwork === true
    const merchant = await runMerchant({
      fm,
      oracleUrl,
      onAnswer: (answer) => emit({ type: 'answer', ...answer }),
      log: async (text) => {
        emit({ type: 'step', text })
        step++
        if (cut && step === 5) {
          networkDown = true
          emit({
            type: 'network',
            down: true,
            text: 'The seller’s blockchain connection is cut. Payments keep flowing: the certificate is cached and signatures are checked locally. Redemption waits.',
          })
        } else if (cut && step === 12) {
          networkDown = false
          emit({
            type: 'network',
            down: false,
            text: 'Connection restored. One transaction collects everything accepted while it was down.',
          })
          await oracle.redeemer?.tick({ force: true })
          return
        }
        if (!networkDown) await oracle.redeemer?.tick()
      },
    })
    if (cfg.scenarios?.stealKey) await stealKey({ cfg, pub, fmAddr, id, oracle, emit, env })
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

/** "Steal the agent key" (§13.3): three real attempts by a thief holding the agent's key. None can succeed. */
async function stealKey(o: {
  cfg: LiveDemoConfig
  pub: PublicClient
  fmAddr: Hex
  id: Hex
  oracle: ReturnType<typeof createOracle>
  emit: (e: LiveEvent) => void
  env: Record<string, string | undefined>
}) {
  const { cfg, pub, fmAddr, id, oracle, emit } = o
  const chain = getChain(cfg.chain)
  const cert = (await readCertificate(pub, fmAddr, id))!
  const thief = cfg.agent // the stolen key
  const note = (cumulative: bigint) =>
    signNote(thief, chain.chain.id, fmAddr, { certificateId: id, cumulative, memo: newRequestId() })
  const ask = async (
    app: { fetch: (r: Request) => Response | Promise<Response> },
    n: Awaited<ReturnType<typeof note>>,
  ) => {
    const res = await app.fetch(
      new Request('http://oracle.internal/v1/proverb', { headers: { [NOTE_HEADER]: encodeHeader(n) } }),
    )
    return { status: res.status, reason: res.headers.get('Flying-Money-Reason') ?? '' }
  }

  // 1. Overspend at the named seller: a note above the face value.
  const over = await note(cert.faceValue + 10_000n)
  const r1 = await ask(oracle.app, over)
  emit({
    type: 'thief',
    attempt: `Signs a note for ${fmt(cert.faceValue + 10_000n)} USDC, above the ${fmt(cert.faceValue)} face value, at the Silk Road Oracle`,
    refused: r1.status !== 200,
    detail: r1.status === 200 ? 'accepted (unexpected)' : `refused by the seller: HTTP ${r1.status} ${r1.reason}`,
  })

  // 2. Ask the contract itself to pay that note (eth_call: no transaction, no gas).
  let revert = ''
  try {
    await pub.simulateContract({
      account: thief,
      address: fmAddr,
      abi: flyingMoneyAbi,
      functionName: 'redeem',
      args: [id, over.cumulative, over.memo, over.sig],
    })
  } catch (e) {
    const r = e instanceof BaseError ? e.walk((x) => x instanceof ContractFunctionRevertedError) : null
    revert = r instanceof ContractFunctionRevertedError ? (r.data?.errorName ?? 'reverted') : 'reverted'
  }
  emit({
    type: 'thief',
    attempt: 'Tries to redeem that note on-chain',
    refused: revert !== '',
    detail: revert ? `the contract refuses: ${revert}` : 'the call succeeded (unexpected)',
  })

  // 3. Pay a different seller with the stolen key (a second, real seller with its own address).
  const other = createOracle({
    accepts: [cfg.chain],
    payee: privateKeyToAccount(generatePrivateKey()).address,
    store: sellerMemoryStore(),
    env: o.env,
    readCertificate: (_c, contract, cid) => readCertificate(pub, contract, cid),
  })
  const r3 = await ask(other.app, await note(cert.redeemed + 10_000n))
  emit({
    type: 'thief',
    attempt: 'Tries to pay a different seller with the same key',
    refused: r3.status !== 200,
    detail:
      r3.status === 200
        ? 'accepted (unexpected)'
        : `refused: HTTP ${r3.status} ${r3.reason} (the money can only go to the named payee)`,
  })
}

/** USDC base units → "0.30" (display only; amounts stay bigint). */
const fmt = (v: bigint) => {
  const [i = '0', f = ''] = formatUnits(v, 6).split('.')
  return `${i}.${f.replace(/0+$/, '').padEnd(2, '0')}`
}
