import { createBridge } from '@flying-money/bridge'
import { getChain, setLocalDeployment } from '@flying-money/chains'
import { createFlyingMoneyClient, memoryStore } from '@flying-money/client'
import { type Certificate, certificateId, type Hex } from '@flying-money/core'
import { memoryStore as sellerStore } from '@flying-money/server'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { createFlyingMoneyMcp } from '../src/server.js'

// An agent meets an ordinary x402 site (one that has never heard of Flying Money). With the owner's bridge configured,
// the same tools (fm_quote, fm_paid_fetch, fm_request_budget) pay it from a budget made for the bridge.
const CONTRACT: Hex = '0x00000000000000000000000000000000000f1f1f'
const USDC: Hex = '0x00000000000000000000000000000000000c0c0c'
setLocalDeployment({ usdc: USDC, flyingMoney: CONTRACT })
const CHAIN_ID = 31337
const SITE = 'https://api.example.test/premium'
const BRIDGE = 'http://bridge.test'

async function setup(opts: { withBudget?: boolean; withBridge?: boolean } = {}) {
  const { withBudget = true, withBridge = true } = opts
  const float = privateKeyToAccount(generatePrivateKey())
  const agent = privateKeyToAccount(generatePrivateKey())
  const funder = privateKeyToAccount(generatePrivateKey()).address
  const cert: Certificate = {
    id: certificateId(CHAIN_ID, CONTRACT, funder, 0n),
    funder,
    payee: float.address,
    spender: agent.address,
    faceValue: 100_000n,
    redeemed: 0n,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400),
    closed: false,
  }
  const reader = async (_c: number, _k: Hex, id: Hex) =>
    id.toLowerCase() === cert.id.toLowerCase() ? { ...cert } : null

  let paidCalls = 0
  // the stranger's x402 site: 402 with PAYMENT-REQUIRED, then 200 once a PAYMENT-SIGNATURE arrives
  const site = (async (input: URL | RequestInfo, init?: RequestInit) => {
    if (new Headers(init?.headers).get('payment-signature')) {
      paidCalls++
      return new Response(JSON.stringify({ fact: 'paid' }), {
        status: 200,
        headers: { 'content-type': 'application/json', 'payment-response': btoa(JSON.stringify({ success: true })) },
      })
    }
    const required = {
      x402Version: 2,
      error: 'Payment required',
      resource: { url: String(input) },
      accepts: [
        {
          scheme: 'exact',
          network: 'eip155:84532',
          amount: '1000',
          asset: getChain('base-sepolia').usdc,
          payTo: '0x00000000000000000000000000000000000a11ce',
          maxTimeoutSeconds: 60,
          extra: { name: 'USDC', version: '2' },
        },
      ],
    }
    return new Response('{}', { status: 402, headers: { 'payment-required': btoa(JSON.stringify(required)) } })
  }) as typeof fetch

  const bridge = createBridge({
    accepts: ['anvil'],
    float,
    store: sellerStore(),
    readCertificate: reader,
    upstreamNetworks: ['eip155:84532'],
    maxUpstreamAmount: 50_000n,
    fetch: site,
    target: { allowLocal: true }, // the fake site host does not resolve
  })
  const doFetch = ((u: RequestInfo | URL, init?: RequestInit) =>
    String(u).startsWith(BRIDGE) ? bridge.app.fetch(new Request(u, init)) : site(u, init)) as typeof fetch

  const fm = createFlyingMoneyClient({
    chains: ['anvil'],
    spender: agent,
    store: memoryStore(),
    certificates: withBudget ? [cert.id] : [],
    maxPricePerRequest: 50_000n,
    readCertificate: reader,
    fetch: doFetch,
  })
  const server = createFlyingMoneyMcp({
    client: fm,
    maxPricePerRequest: 50_000n,
    fetch: doFetch,
    canRequest: true,
    ...(withBridge ? { bridgeUrl: BRIDGE } : {}),
  })
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'tester-agent', version: '1.0.0' })
  await Promise.all([server.connect(a), client.connect(b)])
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await client.callTool({ name, arguments: args })
    const t = (r.content as Array<{ text: string }>)[0]?.text ?? ''
    return {
      isError: Boolean(r.isError),
      text: t,
      json: (() => {
        try {
          return JSON.parse(t)
        } catch {
          return null
        }
      })(),
    }
  }
  return { call, float, paidCalls: () => paidCalls, cert }
}

describe('MCP: ordinary x402 sites through the owner’s bridge', () => {
  it('fm_quote prices an x402 site through the bridge, and says the budget can pay it', async () => {
    const { call, paidCalls } = await setup()
    const q = await call('fm_quote', { url: SITE })
    expect(q.json).toMatchObject({ via: 'bridge', price: '0.001', payable: true })
    expect(q.json.note).toMatch(/regular x402 site/)
    expect(paidCalls()).toBe(0) // quoting never pays
  })

  it('fm_paid_fetch pays the x402 site from the budget and returns its answer', async () => {
    const { call, paidCalls } = await setup()
    const r = await call('fm_paid_fetch', { url: SITE })
    expect(r.isError).toBe(false)
    expect(r.json).toMatchObject({ status: 200, via: 'bridge' })
    expect(JSON.parse(r.json.body)).toEqual({ fact: 'paid' })
    expect(r.json.payment.price).toBe('0.001')
    expect(paidCalls()).toBe(1)
    const s = await call('fm_status')
    expect(s.json.certificates[0].spent).toMatch(/^0\.001/)
  })

  it('max_price still protects the agent on the bridged path', async () => {
    const { call, paidCalls } = await setup()
    const r = await call('fm_paid_fetch', { url: SITE, max_price: '0.0001' })
    expect(r.isError).toBe(true)
    expect(r.text).toMatch(/above your max_price/)
    expect(paidCalls()).toBe(0)
  })

  it('without a budget the agent gets a structured no_certificate naming the bridge as the payee', async () => {
    const { call, float, paidCalls } = await setup({ withBudget: false })
    const r = await call('fm_paid_fetch', { url: SITE })
    expect(r.isError).toBe(true)
    expect(r.json).toMatchObject({ error: 'no_certificate', via: 'bridge', canRequest: true })
    expect(r.json.payee.toLowerCase()).toBe(float.address.toLowerCase())
    expect(r.json.next).toMatch(/fm_request_budget/)
    expect(paidCalls()).toBe(0)
  })

  it('without a bridge configured, an x402 site is reported as unpaid, not silently paid', async () => {
    const { call, paidCalls } = await setup({ withBridge: false })
    const r = await call('fm_paid_fetch', { url: SITE })
    expect(r.json.status).toBe(402)
    expect(paidCalls()).toBe(0)
  })

  it('fm_request_status waits for the saved state to load, so a fresh process finds its own request', async () => {
    let loaded = false
    const fake = {
      ready: new Promise<void>((r) =>
        setTimeout(() => {
          loaded = true
          r()
        }, 30),
      ),
      requestStatus: async () => {
        if (!loaded) throw new Error('unknown request 0x01')
        return {
          requestId: '0x01',
          status: 'asked',
          chain: 'anvil',
          via: 'link',
          link: 'https://example.test/approve',
          request: { origin: BRIDGE, amount: 20_000n, validFor: 259_200n, payee: '0x0' },
        }
      },
    }
    const server = createFlyingMoneyMcp({ client: fake as never, maxPricePerRequest: 1n, canRequest: true })
    const [a, b] = InMemoryTransport.createLinkedPair()
    const client = new Client({ name: 'tester-agent', version: '1.0.0' })
    await Promise.all([server.connect(a), client.connect(b)])
    const r = await client.callTool({ name: 'fm_request_status', arguments: { requestId: '0x01' } })
    expect(r.isError).toBeFalsy()
    expect((r.content as Array<{ text: string }>)[0]?.text).toContain('"status": "asked"')
  })
})
