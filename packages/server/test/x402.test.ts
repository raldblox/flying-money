import {
  certKey,
  decodeReceipt,
  NOTE_HEADER,
  OFFER_HEADER,
  RECEIPT_HEADER,
  X402_REQUIRED_HEADER,
  X402_RESPONSE_HEADER,
  X402_SIGNATURE_HEADER,
  type X402Requirements,
  x402OfferFromRequired,
  x402PaymentPayload,
  x402ReceiptFromResponse,
} from '@flying-money/core'
import { Hono } from 'hono'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { flyingMoney } from '../src/hono.js'
import { memoryStore } from '../src/index.js'
import { CHAIN_ID, Clock, FakeChain, note, payee } from './fixtures.js'

// The x402 transport (docs/design/x402-flying-money-scheme.md): a slip arriving in PAYMENT-SIGNATURE goes through the
// same seller checks as Flying-Money-Note, so S1–S4 hold unchanged. These tests pin the envelope and that equivalence.
function app(x402: boolean) {
  const chain = new FakeChain()
  const clock = new Clock()
  const spenderKey = generatePrivateKey()
  const cert = chain.issue({
    faceValue: 25n,
    expiresAt: BigInt(clock.t) + 7n * 86_400n,
    spender: privateKeyToAccount(spenderKey).address,
  })
  const store = memoryStore()
  let runs = 0
  const a = new Hono()
  a.use(
    '/v1/*',
    flyingMoney({
      accepts: ['anvil'],
      payee: payee.address,
      store,
      readCertificate: chain.reader,
      now: clock.now,
      price: () => 10n,
      x402,
    }),
  )
  a.get('/v1/data', (c) => {
    runs++
    return c.json({ ok: true })
  })
  const url = 'http://x/v1/data'
  return { a, url, cert, spenderKey, store, key: certKey(CHAIN_ID, cert.id), runs: () => runs }
}

async function requirements(a: Hono, url: string): Promise<X402Requirements> {
  const res = await a.request(url)
  const header = res.headers.get(X402_REQUIRED_HEADER)
  expect(header).toBeTruthy()
  return (JSON.parse(atob(header!)) as { accepts: X402Requirements[] }).accepts[0]!
}

describe('x402 transport on the seller middleware', () => {
  it('a 402 advertises the same offer in PAYMENT-REQUIRED, next to Flying-Money-Offer', async () => {
    const { a, url } = app(true)
    const res = await a.request(url)
    expect(res.status).toBe(402)
    expect(res.headers.get(OFFER_HEADER)).toBeTruthy()
    const offer = x402OfferFromRequired(res.headers.get(X402_REQUIRED_HEADER)!)
    expect(offer?.price).toBe(10n)
    expect(offer?.accepts[0]?.payee).toBe(payee.address)
    const pr = JSON.parse(atob(res.headers.get(X402_REQUIRED_HEADER)!))
    expect(pr.resource.url).toBe(url)
  })

  it('a slip in PAYMENT-SIGNATURE is served once, with PAYMENT-RESPONSE carrying the receipt', async () => {
    const { a, url, cert, spenderKey, store, key, runs } = app(true)
    const req = await requirements(a, url)
    const n = await note(spenderKey, cert.id, 10n)
    const sig = x402PaymentPayload(n.signed, req, { url })
    const res = await a.request(url, { headers: { [X402_SIGNATURE_HEADER]: sig } })
    expect(res.status).toBe(200)
    const sr = JSON.parse(atob(res.headers.get(X402_RESPONSE_HEADER)!))
    expect(sr).toMatchObject({ success: true, transaction: '', network: `eip155:${CHAIN_ID}` })
    const receipt = x402ReceiptFromResponse(res.headers.get(X402_RESPONSE_HEADER)!)
    expect(receipt).toEqual(decodeReceipt(res.headers.get(RECEIPT_HEADER)!))
    expect(receipt?.status).toBe('SERVED')
    // retrying the same payment (S1) serves the stored result without charging again
    const again = await a.request(url, { headers: { [X402_SIGNATURE_HEADER]: sig } })
    expect(again.status).toBe(200)
    expect(runs()).toBe(1)
    expect(await store.state(key)).toMatchObject({ consumed: 10n, reserved: 0n })
  })

  it('the same limits apply: a slip past the budget is refused and nothing runs', async () => {
    const { a, url, cert, spenderKey, runs } = app(true)
    const req = await requirements(a, url)
    const over = await note(spenderKey, cert.id, 30n) // face value is 25
    const res = await a.request(url, { headers: { [X402_SIGNATURE_HEADER]: x402PaymentPayload(over.signed, req) } })
    expect(res.status).toBe(402)
    expect(res.headers.get(X402_REQUIRED_HEADER)).toBeTruthy()
    expect(runs()).toBe(0)
  })

  it('a malformed PAYMENT-SIGNATURE is refused like a bad slip, never served', async () => {
    const { a, url, runs } = app(true)
    // exactly what a malformed Flying-Money-Note gets
    const fm1 = (await a.request(url, { headers: { [NOTE_HEADER]: 'fm1.garbage' } })).status
    expect(fm1).toBeGreaterThanOrEqual(400)
    for (const bad of ['garbage', btoa('{"x402Version":2}'), btoa('[]')]) {
      const res = await a.request(url, { headers: { [X402_SIGNATURE_HEADER]: bad } })
      expect(res.status).toBe(fm1)
    }
    expect(runs()).toBe(0)
  })

  it('both headers on one request are refused (no way to smuggle a second slip)', async () => {
    const { a, url, cert, spenderKey, runs } = app(true)
    const req = await requirements(a, url)
    const n1 = await note(spenderKey, cert.id, 10n)
    const n2 = await note(spenderKey, cert.id, 20n)
    const res = await a.request(url, {
      headers: { [NOTE_HEADER]: n1.header, [X402_SIGNATURE_HEADER]: x402PaymentPayload(n2.signed, req) },
    })
    expect(res.status).toBe(400)
    expect(runs()).toBe(0)
  })

  it('off by default: no PAYMENT-REQUIRED, and PAYMENT-SIGNATURE is ignored', async () => {
    const { a, url, cert, spenderKey, runs } = app(false)
    const res = await a.request(url)
    expect(res.status).toBe(402)
    expect(res.headers.get(X402_REQUIRED_HEADER)).toBeNull()
    const on = app(true)
    const req = await requirements(on.a, on.url)
    const n = await note(spenderKey, cert.id, 10n)
    const paid = await a.request(url, { headers: { [X402_SIGNATURE_HEADER]: x402PaymentPayload(n.signed, req) } })
    expect(paid.status).toBe(402)
    expect(runs()).toBe(0)
  })
})
