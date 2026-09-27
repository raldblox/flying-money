// Phase 3 acceptance (BUILD_SPEC §17): end-to-end on a local anvil with the real contract, client, server and redeemer.
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { flyingMoneyAbi, flyingMoneyBytecode, mockUsdcAbi, mockUsdcBytecode } from '@flying-money/abi'
import { setLocalDeployment } from '@flying-money/chains'
import {
  certKey,
  decodeSpendRequest,
  encodeHeader,
  type Hex,
  NOTE_HEADER,
  newRequestId,
  readCertificate,
  signNote,
  verifySpendRequest,
} from '@flying-money/core'
import {
  createIdempotency,
  createRedeemer,
  type InboxRecord,
  type Lock,
  memoryLock,
  type NoteStore,
  onChainApproval,
  memoryStore as sellerStore,
} from '@flying-money/server'
import { flyingMoney } from '@flying-money/server/hono'
import { Hono } from 'hono'
import { createPublicClient, createWalletClient, http, type PublicClient } from 'viem'
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'
import { anvil as anvilChain } from 'viem/chains'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createFlyingMoneyClient, memoryRequestStore, memoryStore, NoCertificateError } from '../src/index.js'
import { ANVIL_MNEMONIC, anvilAvailable, startAnvil } from './anvil.js'

const PRICE = 10_000n // 0.01 USDC
const acct = (i: number) => mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: i })
const deployer = acct(0)
const funder = acct(1)
const payee = acct(2)
const redeemerAccount = acct(3)
const otherPayee = acct(4)

describe.runIf(anvilAvailable)('anvil integration (§17 Phase 3 ✅)', () => {
  let stop = () => {}
  let env: Record<string, string> = {}
  let pub: PublicClient
  let usdc: Hex
  let fm: Hex

  const wait = (hash: Hex) => pub.waitForTransactionReceipt({ hash, pollingInterval: 50 })
  const balance = (who: Hex) =>
    pub.readContract({ address: usdc, abi: mockUsdcAbi, functionName: 'balanceOf', args: [who] })
  const funderWallet = () => createWalletClient({ account: funder, chain: anvilChain, transport: http(env.RPC_ANVIL) })

  async function issue(face: bigint, spender: Hex, to: Hex = payee.address): Promise<Hex> {
    const { timestamp } = await pub.getBlock()
    const args = [to, spender, face, timestamp + 7n * 86_400n] as const
    const { result } = await pub.simulateContract({
      account: funder,
      address: fm,
      abi: flyingMoneyAbi,
      functionName: 'issue',
      args,
    })
    await wait(await funderWallet().writeContract({ address: fm, abi: flyingMoneyAbi, functionName: 'issue', args }))
    return result
  }

  function seller(store: NoteStore, opts: { payeeAddr?: Hex; failEvery?: number } = {}) {
    const app = new Hono()
    const jobs = createIdempotency()
    let n = 0
    const mw = flyingMoney({
      accepts: ['anvil'],
      payee: opts.payeeAddr ?? payee.address,
      store,
      env,
      price: () => PRICE,
      requestStatus: async (rid) => jobs.status(rid),
    })
    app.use('/v1/*', mw)
    app.get('/v1/tea', async (c) => {
      const { requestId } = c.get('flyingMoney')
      const out = await jobs.runOnce(requestId, async () => ({
        city: c.req.query('city') ?? "Chang'an",
        price: 42,
        illustrative: true,
        n: ++n,
      }))
      return c.json(out)
    })
    app.get('/v1/flaky', async (c) => {
      n++
      if (opts.failEvery && n % opts.failEvery === 0) return c.json({ error: 'upstream' }, 500)
      return c.json({ ok: true })
    })
    return { app, mw }
  }

  const clientFor = (spenderKey: Hex, ids: Hex[], app: Hono) =>
    createFlyingMoneyClient({
      chains: ['anvil'],
      spender: privateKeyToAccount(spenderKey),
      store: memoryStore(),
      certificates: ids,
      maxPricePerRequest: 50_000n,
      env,
      fetch: ((u: RequestInfo | URL, init?: RequestInit) => app.request(String(u), init)) as typeof fetch,
    })

  const redeemerFor = (
    store: NoteStore,
    minAmount: bigint,
    events: Array<{ txHash: Hex; cumulative: bigint; paid: bigint }>,
    lock?: Lock,
  ) =>
    createRedeemer({
      chains: ['anvil'],
      store,
      ...(lock ? { lock } : {}),
      redeemerAccount,
      env,
      pollingIntervalMs: 50,
      policy: { minAmount, maxAgeSeconds: 3600, safetyBeforeExpiry: 1800 },
      onRedeemed: (e) => events.push(e),
      onError: (e) => {
        throw e
      },
    })

  beforeAll(async () => {
    const a = await startAnvil()
    stop = a.stop
    env = { RPC_ANVIL: a.url }
    pub = createPublicClient({ chain: anvilChain, transport: http(a.url), pollingInterval: 50 }) as PublicClient
    const w = createWalletClient({ account: deployer, chain: anvilChain, transport: http(a.url) })
    usdc = (await wait(await w.deployContract({ abi: mockUsdcAbi, bytecode: mockUsdcBytecode }))).contractAddress!
    fm = (
      await wait(await w.deployContract({ abi: flyingMoneyAbi, bytecode: flyingMoneyBytecode, args: [usdc, 0n, 0n] }))
    ).contractAddress!
    setLocalDeployment({ usdc, flyingMoney: fm })
    const fw = funderWallet()
    await wait(await fw.writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'faucet' }))
    await wait(
      await fw.writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'approve', args: [fm, 2n ** 255n] }),
    )
  }, 60_000)
  afterAll(() => stop())

  it('50 requests → ≤ 3 redemptions → payee balance = Σ prices served', async () => {
    const spenderKey = generatePrivateKey()
    const id = await issue(1_000_000n, privateKeyToAccount(spenderKey).address)
    const store = sellerStore()
    const { app } = seller(store)
    const client = clientFor(spenderKey, [id], app)
    const events: Array<{ txHash: Hex; cumulative: bigint; paid: bigint }> = []
    const redeemer = redeemerFor(store, 200_000n, events)
    const before = await balance(payee.address)
    for (let i = 0; i < 50; i++) {
      const res = await client.fetch(`http://oracle.test/v1/tea?city=Luoyang${i}`)
      expect(res.status).toBe(200)
      await redeemer.tick()
    }
    await redeemer.tick({ force: true })
    const txs = new Set(events.map((e) => e.txHash))
    expect(txs.size).toBeLessThanOrEqual(3)
    expect(txs.size).toBeGreaterThanOrEqual(1)
    expect((await balance(payee.address)) - before).toBe(50n * PRICE)
    const onchain = (await readCertificate(pub, fm, id))!
    expect(onchain.redeemed).toBe(50n * PRICE)
    expect(client.status()[0]).toMatchObject({ spentLocal: 500_000n, consumed: 500_000n, remaining: 500_000n })
  }, 120_000)

  it('F8: two redeemer instances sharing a store and a lock submit one batch, never two', async () => {
    const spenderKey = generatePrivateKey()
    const id = await issue(1_000_000n, privateKeyToAccount(spenderKey).address)
    const inner = sellerStore()
    const submissions: Hex[] = []
    // a slow store widens the check-then-submit window, like two serverless instances on Upstash
    const store = new Proxy(inner, {
      get(t, prop, recv) {
        const v = Reflect.get(t, prop, recv) as (...a: unknown[]) => Promise<unknown>
        if (prop === 'getSubmission')
          return async (...a: unknown[]) => {
            const r = await v.apply(t, a)
            await new Promise((res) => setTimeout(res, 100))
            return r
          }
        if (prop === 'setSubmission')
          return async (chainId: number, sub: { txHash: Hex } | null) => {
            if (sub) submissions.push(sub.txHash)
            return v.apply(t, [chainId, sub])
          }
        return typeof v === 'function' ? v.bind(t) : v
      },
    }) as NoteStore
    const { app } = seller(inner)
    const client = clientFor(spenderKey, [id], app)
    for (let i = 0; i < 5; i++) expect((await client.fetch(`http://oracle.test/v1/tea?i=${i}`)).status).toBe(200)
    const lock = memoryLock()
    const events: Array<{ txHash: Hex; cumulative: bigint; paid: bigint }> = []
    const a = redeemerFor(store, 1n, events, lock)
    const b = redeemerFor(store, 1n, events, lock)
    await Promise.all([a.tick({ force: true }), b.tick({ force: true })])
    expect(submissions).toHaveLength(1)
    expect((await readCertificate(pub, fm, id))!.redeemed).toBe(5n * PRICE)
  }, 60_000)

  it('F12: a broadcast error on a tx that did go out keeps the submission: no second batch while it is pending', async () => {
    const spenderKey = generatePrivateKey()
    const id = await issue(1_000_000n, privateKeyToAccount(spenderKey).address)
    const store = sellerStore()
    const { app } = seller(store)
    const client = clientFor(spenderKey, [id], app)
    for (let i = 0; i < 3; i++) expect((await client.fetch(`http://oracle.test/v1/tea?f12=${i}`)).status).toBe(200)

    // an RPC in front of anvil: the broadcast reaches the chain but reports an error, and the node is slow to know
    // the transaction (getTransactionByHash → null), exactly the lagging case
    let broadcasts = 0
    let lagging = true
    const rpc = (body: unknown) =>
      fetch(env.RPC_ANVIL!, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      }).then((r) => r.json() as Promise<{ id: number; result?: unknown; error?: unknown }>)
    const proxy = createServer(async (req, res) => {
      let raw = ''
      for await (const c of req) raw += c
      const msg = JSON.parse(raw) as { id: number; method: string }
      let out: unknown
      if (msg.method === 'eth_sendRawTransaction') {
        broadcasts++
        await rpc(msg)
        out = { jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: 'upstream timeout' } }
      } else if (msg.method === 'eth_getTransactionByHash' && lagging)
        out = { jsonrpc: '2.0', id: msg.id, result: null }
      else out = await rpc(msg)
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(out))
    })
    await new Promise<void>((r) => proxy.listen(0, '127.0.0.1', r))
    const url = `http://127.0.0.1:${(proxy.address() as AddressInfo).port}`
    const errors: Error[] = []
    const redeemer = createRedeemer({
      chains: ['anvil'],
      store,
      redeemerAccount,
      env: { RPC_ANVIL: url },
      pollingIntervalMs: 50,
      policy: { minAmount: 1n, maxAgeSeconds: 3600, safetyBeforeExpiry: 1800 },
      onError: (e) => errors.push(e),
    })
    await rpc({ jsonrpc: '2.0', id: 1, method: 'evm_setAutomine', params: [false] })
    try {
      await redeemer.tick({ force: true }) // sends; the RPC says it failed; the tx sits in the mempool
      await redeemer.tick({ force: true }) // still pending: must wait, never send a second batch
      expect(broadcasts).toBe(1)
      expect(await store.getSubmission(anvilChain.id)).not.toBeNull()
      lagging = false
      await rpc({ jsonrpc: '2.0', id: 2, method: 'evm_mine', params: [] })
      await redeemer.tick({ force: true }) // mined: settled from the kept submission
      expect(broadcasts).toBe(1)
      expect(await store.getSubmission(anvilChain.id)).toBeNull()
      expect((await readCertificate(pub, fm, id))!.redeemed).toBe(3n * PRICE)
    } finally {
      await rpc({ jsonrpc: '2.0', id: 3, method: 'evm_setAutomine', params: [true] })
      await new Promise<void>((r) => proxy.close(() => r()))
    }
  }, 60_000)

  it('inbox R2: approval is verified against the real CertificateIssued event (wrong spender, payee or funder refused)', async () => {
    const agentKey = privateKeyToAccount(generatePrivateKey())
    const { timestamp } = await pub.getBlock()
    const args = [payee.address, agentKey.address, 300_000n, timestamp + 7n * 86_400n] as const
    const { result: id } = await pub.simulateContract({
      account: funder,
      address: fm,
      abi: flyingMoneyAbi,
      functionName: 'issue',
      args,
    })
    const txHash = await funderWallet().writeContract({ address: fm, abi: flyingMoneyAbi, functionName: 'issue', args })
    await wait(txHash)
    const check = onChainApproval((c) => (c === anvilChain.id ? { pub, contract: fm } : undefined))
    const rec = (o: Partial<InboxRecord> = {}): InboxRecord => ({
      requestId: newRequestId(),
      chainId: anvilChain.id,
      request: { certificateId: `0x${'0'.repeat(64)}` },
      sig: '0x',
      grantId: newRequestId(),
      owner: funder.address,
      requester: agentKey.address,
      payee: payee.address,
      status: 'asked',
      expiresAt: 0,
      ...o,
    })
    const stranger = privateKeyToAccount(generatePrivateKey()).address
    expect(await check(rec(), { certificateId: id, txHash })).toBeNull()
    expect(await check(rec({ requester: stranger }), { certificateId: id, txHash })).toBe('wrong spender')
    expect(await check(rec({ payee: stranger }), { certificateId: id, txHash })).toBe('wrong payee')
    expect(await check(rec({ owner: stranger }), { certificateId: id, txHash })).toBe('wrong funder')
    expect(await check(rec(), { certificateId: newRequestId(), txHash })).toMatch(/no budget/)
    expect(await check(rec(), { certificateId: id, txHash: newRequestId() })).toMatch(/not found/)
  }, 60_000)

  it('overspend is refused at the cap; a note above face value is rejected', async () => {
    const spenderKey = generatePrivateKey()
    const id = await issue(5n * PRICE, privateKeyToAccount(spenderKey).address)
    const { app } = seller(sellerStore())
    const client = clientFor(spenderKey, [id], app)
    for (let i = 0; i < 5; i++) expect((await client.fetch('http://oracle.test/v1/tea')).status).toBe(200)
    await expect(client.fetch('http://oracle.test/v1/tea')).rejects.toBeInstanceOf(NoCertificateError)
    // a thief with the key signs past face value directly
    const thief = await signNote(privateKeyToAccount(spenderKey), anvilChain.id, fm, {
      certificateId: id,
      cumulative: 6n * PRICE,
      memo: newRequestId(),
    })
    const r = await app.request('http://oracle.test/v1/tea', { headers: { [NOTE_HEADER]: encodeHeader(thief) } })
    expect(r.status).toBe(402)
    expect(r.headers.get('Flying-Money-Reason')).toBe('insufficient')
  }, 60_000)

  it('wrong payee: the note is useless at another seller; the client refuses to pay it', async () => {
    const spenderKey = generatePrivateKey()
    const id = await issue(100_000n, privateKeyToAccount(spenderKey).address)
    const other = seller(sellerStore(), { payeeAddr: otherPayee.address })
    const client = clientFor(spenderKey, [id], other.app)
    await expect(client.fetch('http://other.test/v1/tea')).rejects.toBeInstanceOf(NoCertificateError)
    const n = await signNote(privateKeyToAccount(spenderKey), anvilChain.id, fm, {
      certificateId: id,
      cumulative: PRICE,
      memo: newRequestId(),
    })
    const r = await other.app.request('http://other.test/v1/tea', { headers: { [NOTE_HEADER]: encodeHeader(n) } })
    expect(r.status).toBe(402)
    expect(r.headers.get('Flying-Money-Reason')).toBe('wrong-payee')
  }, 60_000)

  it('replay: resending an accepted note returns the same response and charges nothing more', async () => {
    const spenderKey = generatePrivateKey()
    const id = await issue(100_000n, privateKeyToAccount(spenderKey).address)
    const store = sellerStore()
    const { app } = seller(store)
    const n = await signNote(privateKeyToAccount(spenderKey), anvilChain.id, fm, {
      certificateId: id,
      cumulative: PRICE,
      memo: newRequestId(),
    })
    const h = { [NOTE_HEADER]: encodeHeader(n) }
    const first = await (await app.request('http://oracle.test/v1/tea', { headers: h })).text()
    for (let i = 0; i < 5; i++)
      expect(await (await app.request('http://oracle.test/v1/tea', { headers: h })).text()).toBe(first)
    expect(await store.state(certKey(anvilChain.id, id))).toMatchObject({ consumed: PRICE, reserved: 0n })
  }, 60_000)

  it('concurrency: 20 parallel requests from one agent are serialised per certificate', async () => {
    const spenderKey = generatePrivateKey()
    const id = await issue(1_000_000n, privateKeyToAccount(spenderKey).address)
    const store = sellerStore()
    const { app } = seller(store)
    const client = clientFor(spenderKey, [id], app)
    const res = await Promise.all(Array.from({ length: 20 }, () => client.fetch('http://oracle.test/v1/tea')))
    expect(res.every((r) => r.status === 200)).toBe(true)
    expect(await store.state(certKey(anvilChain.id, id))).toMatchObject({
      accepted: 20n * PRICE,
      consumed: 20n * PRICE,
    })
  }, 60_000)

  it('redeem-only-served: credit is never redeemed and returns to the funder at reclaim', async () => {
    const spenderKey = generatePrivateKey()
    const face = 100_000n
    const id = await issue(face, privateKeyToAccount(spenderKey).address)
    const store = sellerStore()
    const { app } = seller(store, { failEvery: 2 })
    const client = clientFor(spenderKey, [id], app)
    for (let i = 0; i < 6; i++) await client.fetch('http://oracle.test/v1/flaky')
    const st = (await store.state(certKey(anvilChain.id, id)))!
    expect(st.accepted).toBeGreaterThan(st.consumed) // there is unspent credit
    const events: Array<{ txHash: Hex; cumulative: bigint; paid: bigint }> = []
    await redeemerFor(store, 1n, events).tick({ force: true })
    for (const e of events) expect(e.cumulative).toBeLessThanOrEqual(st.consumed)
    const onchain = (await readCertificate(pub, fm, id))!
    expect(onchain.redeemed).toBe(st.consumed)

    await pub.request({ method: 'evm_increaseTime' as never, params: [8 * 86_400] as never })
    await pub.request({ method: 'evm_mine' as never, params: [] as never })
    const before = await balance(funder.address)
    await wait(
      await funderWallet().writeContract({ address: fm, abi: flyingMoneyAbi, functionName: 'reclaim', args: [id] }),
    )
    expect((await balance(funder.address)) - before).toBe(face - st.consumed) // includes the unspent credit
  }, 120_000)

  it('store loss: RECOVERED; seller loses ≤ its redemption lag; the buyer never pays for unserved requests', async () => {
    // (runs after the time warp above; issue() uses the new block time)
    const spenderKey = generatePrivateKey()
    const id = await issue(1_000_000n, privateKeyToAccount(spenderKey).address)
    const key = certKey(anvilChain.id, id)
    const storeA = sellerStore()
    const a = seller(storeA)
    const client = createFlyingMoneyClient({
      chains: ['anvil'],
      spender: privateKeyToAccount(spenderKey),
      store: memoryStore(),
      certificates: [id],
      maxPricePerRequest: 50_000n,
      env,
      fetch: ((u: RequestInfo | URL, init?: RequestInit) => current.request(String(u), init)) as typeof fetch,
    })
    let current = a.app
    const events: Array<{ txHash: Hex; cumulative: bigint; paid: bigint }> = []
    const redA = redeemerFor(storeA, 5n * PRICE, events)
    let served = 0n
    for (let i = 0; i < 12; i++) {
      expect((await client.fetch('http://oracle.test/v1/tea')).status).toBe(200)
      served += PRICE
      await redA.tick()
    }
    const atWipe = (await storeA.state(key))!
    const redeemedAtWipe = (await readCertificate(pub, fm, id))!.redeemed
    expect(redeemedAtWipe).toBe(10n * PRICE)
    expect(atWipe.consumed).toBe(12n * PRICE)

    // wipe: a new seller instance with an empty store
    const storeB = sellerStore()
    const b = seller(storeB)
    current = b.app
    const redB = redeemerFor(storeB, 5n * PRICE, events)
    for (let i = 0; i < 10; i++) {
      expect((await client.fetch('http://oracle.test/v1/tea')).status).toBe(200)
      served += PRICE
      await redB.tick()
    }
    await redB.tick({ force: true })
    expect((await storeB.state(key))?.status).toBe('RECOVERED')
    const paid = (await readCertificate(pub, fm, id))!.redeemed
    const sellerLoss = served - paid
    expect(sellerLoss).toBeGreaterThanOrEqual(0n)
    expect(sellerLoss).toBeLessThanOrEqual(atWipe.consumed - redeemedAtWipe) // ≤ redemption lag at wipe time
    expect(paid).toBeLessThanOrEqual(served) // the buyer never pays for anything not served
  }, 120_000)
  it('§21.4.6: 402 → request budget → owner funds → the agent verifies on-chain and pays; decoys never count (R2)', async () => {
    const agentKey = generatePrivateKey()
    const agent = privateKeyToAccount(agentKey)
    const { app } = seller(sellerStore())
    const requestStore = memoryRequestStore()
    const make = () =>
      createFlyingMoneyClient({
        chains: ['anvil'],
        spender: agent,
        store: sharedStore,
        certificates: [], // a brand-new agent: no budget yet
        maxPricePerRequest: 50_000n,
        env,
        owner: funder.address,
        requestLinkBase: 'https://site.test',
        requestStore,
        fetch: ((u: RequestInfo | URL, init?: RequestInit) => app.request(String(u), init)) as typeof fetch,
      })
    const sharedStore = memoryStore()
    const client = make()

    // 1. no budget: the 402 comes back as NoCertificateError with the offer
    const err = await client.fetch('http://oracle.test/v1/tea').catch((e) => e)
    expect(err).toBeInstanceOf(NoCertificateError)

    // 2. the agent asks: a signed link, nothing moves
    const req = await client.requestBudget({
      offer: (err as NoCertificateError).offer,
      amount: 100_000n,
      days: 3,
      reason: 'Tea prices for the Luoyang trip',
      origin: 'http://oracle.test',
    })
    expect(req.status).toBe('asked')
    expect(req.link).toMatch(/^https:\/\/site\.test\/app\/requests\/new#fm1\./)
    expect(verifySpendRequest(decodeSpendRequest(req.link!.split('#')[1]!))).toBe(true)
    expect((await client.requestStatus(req.requestId)).status).toBe('asked')
    // an agent restarted while waiting still knows its request
    const waiting = make()
    await waiting.ready
    expect((await waiting.requestStatus(req.requestId)).status).toBe('asked')

    // 3. decoys (R2): right owner but another spender; right spender but another payee; another funder entirely
    await issue(100_000n, privateKeyToAccount(generatePrivateKey()).address)
    await issue(100_000n, agent.address, otherPayee.address)
    const stranger = acct(5)
    const sw = createWalletClient({ account: stranger, chain: anvilChain, transport: http(env.RPC_ANVIL) })
    await wait(await sw.writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'faucet' }))
    await wait(
      await sw.writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'approve', args: [fm, 2n ** 255n] }),
    )
    const { timestamp } = await pub.getBlock()
    await wait(
      await sw.writeContract({
        address: fm,
        abi: flyingMoneyAbi,
        functionName: 'issue',
        args: [payee.address, agent.address, 100_000n, timestamp + 7n * 86_400n],
      }),
    )
    expect((await client.requestStatus(req.requestId)).status).toBe('asked')

    // 4. the owner approves (for less than asked, which is allowed)
    const id = await issue(60_000n, agent.address)
    const approved = await client.requestStatus(req.requestId)
    expect(approved).toMatchObject({ status: 'approved', certificateId: id, faceValue: 60_000n })

    // 5. the agent pays right away
    expect((await client.fetch('http://oracle.test/v1/tea?city=Luoyang')).status).toBe(200)

    // 6. after a restart, the approved budget is found again from the request store
    const again = make()
    await again.ready
    expect(again.status().map((s) => s.id)).toEqual([id])
    expect((await again.fetch('http://oracle.test/v1/tea?city=Kaifeng')).status).toBe(200)
  }, 120_000)
})
