import { readFileSync } from 'node:fs'
import { getChain, setLocalDeployment } from '@flying-money/chains'
import {
  type Certificate,
  certificateId,
  decodeOffer,
  decodeReceipt,
  encodeHeader,
  type Hex,
  NOTE_HEADER,
  newRequestId,
  OFFER_HEADER,
  RECEIPT_HEADER,
  signNote,
} from '@flying-money/core'
import { memoryRateLimiter, memoryStore } from '@flying-money/server'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { assertPublicTarget, createBridge, isPrivateAddress, viaBridge } from '../src/index.js'
import { memoryOutcomes } from '../src/outcomes.js'

const CONTRACT: Hex = '0x00000000000000000000000000000000000f1f1f'
const USDC: Hex = '0x00000000000000000000000000000000000c0c0c'
setLocalDeployment({ usdc: USDC, flyingMoney: CONTRACT })
const CHAIN_ID = getChain('anvil').chain.id
const UPSTREAM_NETWORK = 'eip155:84532'
const TARGET = 'https://api.example.test/premium'

describe('SSRF guard', () => {
  it('knows private, loopback, link-local and metadata addresses', () => {
    for (const ip of [
      '127.0.0.1',
      '10.1.2.3',
      '172.16.0.1',
      '192.168.1.1',
      '169.254.169.254',
      '100.64.0.1',
      '::1',
      'fd00::1',
      '::ffff:10.0.0.1',
    ])
      expect(isPrivateAddress(ip), ip).toBe(true)
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) expect(isPrivateAddress(ip), ip).toBe(false)
  })
  it('refuses http, credentials, private literals and non-URLs; allowLocal is for tests only', async () => {
    await expect(assertPublicTarget('http://example.com/x')).rejects.toThrow(/https only/)
    await expect(assertPublicTarget('https://user:pw@example.com/x')).rejects.toThrow(/credentials/)
    await expect(assertPublicTarget('https://127.0.0.1/x')).rejects.toThrow(/private/)
    await expect(assertPublicTarget('https://169.254.169.254/latest/meta-data')).rejects.toThrow(/private/)
    await expect(assertPublicTarget('not a url')).rejects.toThrow(/not a URL/)
    await expect(assertPublicTarget('https://other.example', { allowHosts: ['api.example.com'] })).rejects.toThrow(
      /not allowed/,
    )
    await expect(assertPublicTarget('http://127.0.0.1:3000/x', { allowLocal: true })).resolves.toBeInstanceOf(URL)
  })
})

/** An ordinary x402 endpoint, faked: 402 with PAYMENT-REQUIRED, then 200 once a PAYMENT-SIGNATURE arrives. */
function upstream(opts: { amount?: string; network?: string; scheme?: string; failAfterPay?: boolean } = {}) {
  const state = { unpaid: 0, paid: 0, lastSignature: '' }
  const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
    const sig = new Headers(init?.headers).get('payment-signature')
    if (sig) {
      state.paid++
      state.lastSignature = sig
      if (opts.failAfterPay) return new Response('boom', { status: 500 })
      return new Response(JSON.stringify({ fact: 'paid' }), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'payment-response': btoa(JSON.stringify({ success: true, transaction: '0xabc' })),
        },
      })
    }
    state.unpaid++
    const required = {
      x402Version: 2,
      error: 'Payment required',
      resource: { url: String(input) },
      accepts: [
        {
          scheme: opts.scheme ?? 'exact',
          network: opts.network ?? UPSTREAM_NETWORK,
          amount: opts.amount ?? '1000',
          asset: getChain('base-sepolia').usdc,
          payTo: '0x00000000000000000000000000000000000a11ce',
          maxTimeoutSeconds: 60,
          extra: { name: 'USDC', version: '2' },
        },
      ],
    }
    return new Response('{}', { status: 402, headers: { 'payment-required': btoa(JSON.stringify(required)) } })
  }) as typeof fetch
  return { state, fetchFn }
}

function setup(up: ReturnType<typeof upstream>, extra: Partial<Parameters<typeof createBridge>[0]> = {}) {
  const float = privateKeyToAccount(generatePrivateKey())
  const spenderKey = generatePrivateKey()
  const t = 1_800_000_000
  const cert: Certificate = {
    id: certificateId(CHAIN_ID, CONTRACT, privateKeyToAccount(generatePrivateKey()).address, 0n),
    funder: privateKeyToAccount(generatePrivateKey()).address,
    payee: float.address,
    spender: privateKeyToAccount(spenderKey).address,
    faceValue: 100_000n,
    redeemed: 0n,
    expiresAt: BigInt(t) + 7n * 86_400n,
    closed: false,
  }
  const bridge = createBridge({
    accepts: ['anvil'],
    float,
    store: memoryStore(),
    readCertificate: async () => ({ ...cert }),
    upstreamNetworks: [UPSTREAM_NETWORK],
    maxUpstreamAmount: 50_000n,
    fetch: up.fetchFn,
    target: { allowLocal: true }, // the fake host does not resolve; the SSRF cases below turn this off
    now: () => t * 1000,
    ...extra,
  })
  const note = async (cumulative: bigint, memo: Hex = newRequestId()) =>
    encodeHeader(
      await signNote(privateKeyToAccount(spenderKey), CHAIN_ID, CONTRACT, { certificateId: cert.id, cumulative, memo }),
    )
  const call = (header?: string) =>
    bridge.app.request(viaBridge('http://bridge.test', TARGET), header ? { headers: { [NOTE_HEADER]: header } } : {})
  return { bridge, float, cert, note, call }
}

describe('bridge: an ordinary x402 endpoint paid from a Flying Money budget', () => {
  it('quotes the upstream price as a Flying Money offer payable to the bridge', async () => {
    const up = upstream()
    const { call, float } = setup(up)
    const res = await call()
    expect(res.status).toBe(402)
    const offer = decodeOffer(res.headers.get(OFFER_HEADER)!)
    expect(offer.price).toBe(1000n)
    expect(offer.accepts[0]?.payee.toLowerCase()).toBe(float.address.toLowerCase())
    expect(up.state.paid).toBe(0) // quoting never pays
  })

  it('pays the target once and serves its answer; a resent note does not pay again (S1)', async () => {
    const up = upstream()
    const { call, note } = setup(up)
    const header = await note(1000n)
    const first = await call(header)
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ fact: 'paid' })
    expect(first.headers.get('x-upstream-payment-response')).toBeTruthy()
    expect(decodeReceipt(first.headers.get(RECEIPT_HEADER)!).status).toBe('SERVED')
    const again = await call(header)
    expect(again.status).toBe(200)
    expect(up.state.paid).toBe(1)
  })

  it('adds the fee in basis points on top of the upstream price, rounded up', async () => {
    const { call } = setup(upstream({ amount: '1000' }), { feeBps: 100 })
    const res = await call()
    const offer = decodeOffer(res.headers.get(OFFER_HEADER)!)
    expect(offer.price).toBe(1010n)
  })

  it('a target that fails after the bridge paid is not charged to the budget (credited, S3)', async () => {
    const up = upstream({ failAfterPay: true })
    const { call, note } = setup(up)
    const res = await call(await note(1000n))
    expect(res.status).toBe(502)
    expect(decodeReceipt(res.headers.get(RECEIPT_HEADER)!).status).toBe('FAILED_CREDITED')
  })

  it('refuses a target that asks for more than the bridge will pay, before any payment', async () => {
    const up = upstream({ amount: '60000' })
    const { call } = setup(up)
    const res = await call()
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ reason: 'upstream-too-expensive' })
    expect(up.state.paid).toBe(0)
  })

  it('refuses a scheme or network it cannot pay', async () => {
    for (const o of [{ network: 'solana:mainnet' }, { scheme: 'upto' }]) {
      const { call } = setup(upstream(o))
      const res = await call()
      expect(res.status).toBe(422)
      expect(await res.json()).toMatchObject({ reason: 'upstream-unsupported' })
    }
  })

  it('refuses private targets by default, without calling them', async () => {
    const up = upstream()
    const { bridge } = setup(up, { target: {} })
    for (const url of ['http://169.254.169.254/latest', 'https://127.0.0.1/x', 'file:///etc/passwd']) {
      const res = await bridge.app.request(viaBridge('http://bridge.test', url))
      expect(res.status, url).toBe(422)
      expect(await res.json()).toMatchObject({ reason: 'target-refused' })
    }
    expect(up.state.unpaid + up.state.paid).toBe(0)
  })
})

describe('bridge hardening', () => {
  it('refuses a token that is not the real USDC of the network, whatever the site names', async () => {
    const up = upstream()
    const fetchFn = (async (i: URL | RequestInfo, init?: RequestInit) => {
      const r = await up.fetchFn(i, init)
      if (r.status !== 402) return r
      const required = JSON.parse(atob(r.headers.get('payment-required') as string))
      required.accepts[0].asset = '0x000000000000000000000000000000000000dEaD'
      return new Response('{}', { status: 402, headers: { 'payment-required': btoa(JSON.stringify(required)) } })
    }) as typeof fetch
    const { call } = setup({ state: up.state, fetchFn })
    const res = await call()
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ reason: 'upstream-unsupported' })
  })

  it('refuses a quote while the float cannot cover it, before the agent signs anything', async () => {
    const { call } = setup(upstream(), { floatBalance: async () => 999n })
    const res = await call()
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ reason: 'float-low' })
    const ok = setup(upstream(), { floatBalance: async () => 1000n })
    expect((await ok.call()).status).toBe(402) // enough: an ordinary quote
  })

  it('limits quotes per client, since each one can reach a site', async () => {
    const up = upstream()
    const { bridge } = setup(up, { quoteLimitPerMinute: 2, rateLimiter: memoryRateLimiter(), quoteTtlMs: 0 })
    const ask = (n: number) => bridge.app.request(viaBridge('http://bridge.test', `${TARGET}?n=${n}`))
    expect((await ask(1)).status).toBe(402)
    expect((await ask(2)).status).toBe(402)
    const third = await ask(3)
    expect(third.status).toBe(429)
    expect(await third.json()).toMatchObject({ reason: 'rate-limited' })
  })

  it('a restart does not pay the site twice: the stored outcome is replayed for the same note', async () => {
    const up = upstream()
    const store = memoryStore()
    const outcomes = memoryOutcomes()
    const first = setup(up, { store, outcomes })
    const header = await first.note(1000n)
    expect((await first.call(header)).status).toBe(200)
    expect(up.state.paid).toBe(1)
    // a new bridge process: empty in-memory jobs, but the same seller store, outcomes, certificate and float
    const second = createBridge({
      accepts: ['anvil'],
      float: first.float,
      store,
      outcomes,
      readCertificate: async () => ({ ...first.cert }),
      upstreamNetworks: [UPSTREAM_NETWORK],
      maxUpstreamAmount: 50_000n,
      fetch: up.fetchFn,
      target: { allowLocal: true },
      now: () => 1_800_000_000 * 1000,
    })
    const again = await second.app.request(viaBridge('http://bridge.test', TARGET), {
      headers: { [NOTE_HEADER]: header },
    })
    expect(again.status).toBe(200)
    expect(up.state.paid).toBe(1)
  })

  it('keeps its own copy of the connect-time address guard identical to the MCP one', () => {
    const lines = (file: string) => readFileSync(new URL(file, import.meta.url), 'utf8').split(/\r?\n/)
    const mine = lines('../src/net-guard.ts').slice(1)
    const theirs = lines('../../mcp/src/net-guard.ts')
    expect(mine).toEqual(theirs)
  })
})
