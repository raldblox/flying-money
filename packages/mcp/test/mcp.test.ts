import { setLocalDeployment } from '@flying-money/chains'
import { createFlyingMoneyClient, memoryStore } from '@flying-money/client'
import { type Certificate, certificateId, type Hex } from '@flying-money/core'
import { createOracle } from '@flying-money/oracle'
import { memoryStore as sellerStore } from '@flying-money/server'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { createFlyingMoneyMcp } from '../src/server.js'

// §8.4: an MCP agent pays a real seller (the Silk Road Oracle, in-process) and stays inside its certificate.
const CONTRACT: Hex = '0x00000000000000000000000000000000000f1f1f'
const USDC: Hex = '0x00000000000000000000000000000000000c0c0c'
setLocalDeployment({ usdc: USDC, flyingMoney: CONTRACT })
const CHAIN_ID = 31337

async function setup(faceValue = 50_000n, maxPricePerRequest = 50_000n) {
  const key = generatePrivateKey()
  const agent = privateKeyToAccount(key)
  const payee = privateKeyToAccount(generatePrivateKey()).address
  const funder = privateKeyToAccount(generatePrivateKey()).address
  const cert: Certificate = {
    id: certificateId(CHAIN_ID, CONTRACT, funder, 0n),
    funder,
    payee,
    spender: agent.address,
    faceValue,
    redeemed: 0n,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400),
    closed: false,
  }
  const reader = async (_c: number, _k: Hex, id: Hex) =>
    id.toLowerCase() === cert.id.toLowerCase() ? { ...cert } : null
  const oracle = createOracle({
    accepts: ['anvil'],
    payee,
    store: sellerStore(),
    readCertificate: reader,
    fetchWeather: async () => ({ temperature_c: 20, wind_kmh: 5, time: new Date().toISOString() }),
  })
  const doFetch = ((u: RequestInfo | URL, init?: RequestInit) => oracle.app.fetch(new Request(u, init))) as typeof fetch
  const fm = createFlyingMoneyClient({
    chains: ['anvil'],
    spender: agent,
    store: memoryStore(),
    certificates: [cert.id],
    maxPricePerRequest,
    readCertificate: reader,
    fetch: doFetch,
  })
  const server = createFlyingMoneyMcp({ client: fm, maxPricePerRequest, fetch: doFetch })
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 'test-agent', version: '1.0.0' })
  await Promise.all([server.connect(a), client.connect(b)])
  const call = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await client.callTool({ name, arguments: args })
    const text = (r.content as Array<{ type: string; text: string }>)[0]!.text
    return {
      isError: Boolean(r.isError),
      text,
      json: (() => {
        try {
          return JSON.parse(text)
        } catch {
          return null
        }
      })(),
    }
  }
  return { client, call, cert, key, payee }
}

describe('@flying-money/mcp (§8.4)', () => {
  it('exposes exactly the four tools, none of which can issue, top up or reveal the key', async () => {
    const { client } = await setup()
    const names = (await client.listTools()).tools.map((t) => t.name).sort()
    expect(names).toEqual(['fm_explain', 'fm_paid_fetch', 'fm_quote', 'fm_status'])
  })

  it('fm_status and fm_explain describe the budget in plain terms, without the private key', async () => {
    const { call, cert, key, payee } = await setup()
    const s = await call('fm_status')
    expect(s.json.certificates[0]).toMatchObject({ id: cert.id, faceValue: '0.05', remaining: '0.05' })
    const e = await call('fm_explain')
    expect(e.text).toContain(payee)
    expect(e.text.toLowerCase()).toContain('only')
    for (const out of [s.text, e.text]) expect(out.toLowerCase()).not.toContain(key.slice(2).toLowerCase())
  })

  it('fm_quote returns the price without paying; fm_paid_fetch pays and reports the receipt', async () => {
    const { call } = await setup()
    const q = await call('fm_quote', { url: 'http://oracle.test/v1/tea-price?city=Luoyang' })
    expect(q.json).toMatchObject({ paid: false, price: '0.01' })
    expect((await call('fm_status')).json.certificates[0].remaining).toBe('0.05')

    const p = await call('fm_paid_fetch', { url: 'http://oracle.test/v1/tea-price?city=Luoyang' })
    expect(p.isError).toBe(false)
    expect(p.json).toMatchObject({ status: 200, payment: { price: '0.01', cumulative: '0.01' } })
    expect(p.json.body).toContain('Luoyang')
  })

  it('refuses above max_price, and stops at the face value (the certificate enforces the budget)', async () => {
    const { call } = await setup(30_000n)
    const cheap = await call('fm_paid_fetch', {
      url: 'http://oracle.test/v1/route?from=Luoyang&to=Yangzhou',
      max_price: '0.01',
    })
    expect(cheap.isError).toBe(true)
    expect(cheap.text).toMatch(/above your max_price/i)

    for (let i = 0; i < 3; i++) await call('fm_paid_fetch', { url: 'http://oracle.test/v1/tea-price?city=Luoyang' })
    const over = await call('fm_paid_fetch', { url: 'http://oracle.test/v1/tea-price?city=Luoyang' })
    expect(over.isError).toBe(true)
    expect(over.text).toMatch(/face value|insufficient|budget/i)
    expect((await call('fm_status')).json.certificates[0].remaining).toBe('0.00')
  })

  it('rejects non-http(s) URLs', async () => {
    const { call } = await setup()
    const r = await call('fm_paid_fetch', { url: 'file:///etc/passwd' })
    expect(r.isError).toBe(true)
  })
})
