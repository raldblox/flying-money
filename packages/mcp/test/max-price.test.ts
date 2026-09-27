import { setLocalDeployment } from '@flying-money/chains'
import { createFlyingMoneyClient, memoryStore } from '@flying-money/client'
import { type Certificate, certificateId, decodeNote, type Hex, NOTE_HEADER } from '@flying-money/core'
import { memoryStore as sellerStore } from '@flying-money/server'
import { flyingMoney } from '@flying-money/server/hono'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { Hono } from 'hono'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { createFlyingMoneyMcp } from '../src/server.js'

// BUILD_SPEC §22.2 A2: an assistant's per-call max_price is enforced on the offer that is actually signed. A seller
// that quotes low first and high on the paid call can't get a slip above the call's ceiling.
const CONTRACT: Hex = '0x00000000000000000000000000000000000f1f1f'
setLocalDeployment({ usdc: '0x00000000000000000000000000000000000c0c0c', flyingMoney: CONTRACT })
const CHAIN_ID = 31337

async function setup(prices: bigint[]) {
  const key = generatePrivateKey()
  const agent = privateKeyToAccount(key)
  const payee = privateKeyToAccount(generatePrivateKey()).address
  const funder = privateKeyToAccount(generatePrivateKey()).address
  const cert: Certificate = {
    id: certificateId(CHAIN_ID, CONTRACT, funder, 0n),
    funder,
    payee,
    spender: agent.address,
    faceValue: 1_000_000n,
    redeemed: 0n,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400),
    closed: false,
  }
  const reader = async (_c: number, _k: Hex, id: Hex) =>
    id.toLowerCase() === cert.id.toLowerCase() ? { ...cert } : null
  // a seller whose quote changes from one call to the next
  let n = 0
  const app = new Hono()
  app.use(
    '/v1/*',
    flyingMoney({
      accepts: ['anvil'],
      payee,
      store: sellerStore(),
      readCertificate: reader,
      price: () => prices[Math.min(n++, prices.length - 1)]!,
    }),
  )
  app.get('/v1/data', (c) => c.json({ ok: true }))
  const signed: bigint[] = []
  const doFetch = (async (u: RequestInfo | URL, init?: RequestInit) => {
    const note = new Headers(init?.headers).get(NOTE_HEADER)
    if (note) signed.push(decodeNote(note).cumulative)
    return app.fetch(new Request(u, init))
  }) as typeof fetch
  const fm = createFlyingMoneyClient({
    chains: ['anvil'],
    spender: agent,
    store: memoryStore(),
    certificates: [cert.id],
    maxPricePerRequest: 50_000n,
    readCertificate: reader,
    fetch: doFetch,
  })
  const server = createFlyingMoneyMcp({ client: fm, maxPricePerRequest: 50_000n, fetch: doFetch })
  const [a, b] = InMemoryTransport.createLinkedPair()
  const client = new Client({ name: 't', version: '1' })
  await Promise.all([server.connect(a), client.connect(b)])
  const call = async (args: Record<string, unknown>) => {
    const r = await client.callTool({ name: 'fm_paid_fetch', arguments: args })
    return { isError: Boolean(r.isError), text: (r.content as Array<{ text: string }>)[0]!.text }
  }
  return { call, signed, fm }
}

describe('A2: max_price holds against a re-quoting seller', () => {
  it('quotes 0.001 first, 0.005 on the paid call: nothing above 0.001 is signed', async () => {
    const { call, signed } = await setup([1_000n, 5_000n, 5_000n, 5_000n])
    const r = await call({ url: 'http://seller.test/v1/data', max_price: '0.001' })
    expect(r.isError).toBe(true)
    // either refused before signing (the quote was above the ceiling) or the seller refused the slip it got
    expect(r.text).toMatch(/max_price|above|refused/i)
    for (const s of signed) expect(s).toBeLessThanOrEqual(1_000n)
  })

  it('a price within the call’s ceiling is paid normally', async () => {
    const { call, signed } = await setup([2_000n])
    const r = await call({ url: 'http://seller.test/v1/data', max_price: '0.002' })
    expect(r.isError).toBe(false)
    expect(signed).toEqual([2_000n])
  })

  it('the client enforces opts.maxPrice on the offer it signs', async () => {
    const { fm, signed } = await setup([5_000n])
    await fm.ready
    await expect(fm.fetch('http://seller.test/v1/data', {}, { maxPrice: 3_000n })).rejects.toThrow(/price/i)
    expect(signed).toEqual([])
  })
})
