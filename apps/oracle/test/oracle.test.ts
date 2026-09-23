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
import { memoryStore } from '@flying-money/server'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { createOracle, PRICES } from '../src/app.js'

const CONTRACT: Hex = '0x00000000000000000000000000000000000f1f1f'
setLocalDeployment({ usdc: '0x00000000000000000000000000000000000c0c0c', flyingMoney: CONTRACT })
const CHAIN_ID = getChain('anvil').chain.id

function setup() {
  const payee = privateKeyToAccount(generatePrivateKey()).address
  const spenderKey = generatePrivateKey()
  const funder = privateKeyToAccount(generatePrivateKey()).address
  const id = certificateId(CHAIN_ID, CONTRACT, funder, 0n)
  const cert: Certificate = {
    id,
    funder,
    payee,
    spender: privateKeyToAccount(spenderKey).address,
    faceValue: 500_000n,
    redeemed: 0n,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 7 * 86_400),
    closed: false,
  }
  const store = memoryStore()
  const weatherCalls: Array<[number, number]> = []
  const oracle = createOracle({
    accepts: ['anvil'],
    payee,
    store,
    readCertificate: async (_c, _k, q) => (q.toLowerCase() === id.toLowerCase() ? { ...cert } : null),
    fetchWeather: async (lat, lon) => {
      weatherCalls.push([lat, lon])
      return { temperature_c: 21.5, wind_kmh: 7.2, time: '2026-09-23T12:00' }
    },
  })
  let cum = 0n
  const pay = async (path: string, price: bigint, reuse?: string) => {
    cum += price
    const note = await signNote(privateKeyToAccount(spenderKey), CHAIN_ID, CONTRACT, {
      certificateId: id,
      cumulative: cum,
      memo: newRequestId(),
    })
    const header = reuse ?? encodeHeader(note)
    return {
      res: await oracle.app.request(`http://oracle.test${path}`, { headers: { [NOTE_HEADER]: header } }),
      header,
    }
  }
  return { oracle, store, id, payee, pay, weatherCalls, rollback: (p: bigint) => (cum -= p) }
}

describe('Silk Road Oracle (§13.1)', () => {
  it('paid endpoints answer 402 with a flying-money offer at the §13.1 prices', async () => {
    const { oracle } = setup()
    expect(PRICES).toEqual({
      '/v1/tea-price': 10_000n,
      '/v1/route': 20_000n,
      '/v1/weather': 10_000n,
      '/v1/proverb': 5_000n,
    })
    for (const [path, price] of Object.entries(PRICES)) {
      const r = await oracle.app.request(`http://oracle.test${path}`, {
        headers: { origin: 'https://flyingmoney.example' },
      })
      expect(r.status).toBe(402)
      const offer = decodeOffer(r.headers.get(OFFER_HEADER)!)
      expect(offer.price).toBe(price)
      expect(offer.accepts[0]).toMatchObject({ chainId: CHAIN_ID, contract: CONTRACT })
      expect(r.headers.get('access-control-expose-headers')?.toLowerCase()).toContain('flying-money-offer')
    }
  })

  it('serves labelled game data for a valid note, with a receipt', async () => {
    const { pay } = setup()
    const { res } = await pay('/v1/tea-price?city=Luoyang', 10_000n)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toMatchObject({ city: 'Luoyang', currency: 'illustrative strings of cash', illustrative: true })
    expect(typeof body.pricePerJin).toBe('number')
    expect(decodeReceipt(res.headers.get(RECEIPT_HEADER)!)).toMatchObject({ status: 'SERVED', consumed: 10_000n })

    const route = await (await pay('/v1/route?from=Chang%27an&to=Dunhuang', 20_000n)).res.json()
    expect(route).toMatchObject({ from: "Chang'an", to: 'Dunhuang', illustrative: true })
    expect(route.distanceLi).toBeGreaterThan(0)

    const proverb = await (await pay('/v1/proverb', 5_000n)).res.json()
    expect(proverb.text.length).toBeGreaterThan(10)
    expect(proverb.source).toMatch(/Legge|public domain/i)
  })

  it('weather is real (injected in tests), attributed, and fetched once per requestId', async () => {
    const { pay, weatherCalls } = setup()
    const first = await pay('/v1/weather?lat=34.26&lon=108.94', 10_000n)
    const body = await first.res.json()
    expect(body).toMatchObject({
      temperature_c: 21.5,
      source: expect.stringContaining('Open-Meteo'),
      illustrative: false,
    })
    const replay = await pay('/v1/weather?lat=34.26&lon=108.94', 0n, first.header)
    expect(replay.res.status).toBe(200)
    expect(weatherCalls).toHaveLength(1)
  })

  it('bad input is not charged: the price becomes credit (S3)', async () => {
    const { pay, store, id, rollback } = setup()
    const { res } = await pay('/v1/tea-price?city=Atlantis', 10_000n)
    expect(res.status).toBe(400)
    expect(decodeReceipt(res.headers.get(RECEIPT_HEADER)!)).toMatchObject({
      status: 'FAILED_CREDITED',
      credit: 10_000n,
    })
    rollback(10_000n) // the buyer reuses its credit: next == accepted
    const ok = await pay('/v1/tea-price?city=Yangzhou', 10_000n)
    expect(ok.res.status).toBe(200)
    expect(await store.state(`${CHAIN_ID}:${id.toLowerCase()}` as never)).toMatchObject({
      accepted: 10_000n,
      consumed: 10_000n,
    })
  })

  it('free endpoints: /health, /fm/prices, /.well-known/flying-money.json, /openapi.json, /fm/redeemable/:id', async () => {
    const { oracle, pay, id } = setup()
    expect((await oracle.app.request('http://oracle.test/health')).status).toBe(200)
    const prices = await (await oracle.app.request('http://oracle.test/fm/prices')).json()
    expect(prices.prices['/v1/route']).toBe('20000')
    const wk = await (await oracle.app.request('http://oracle.test/.well-known/flying-money.json')).json()
    expect(wk).toMatchObject({ scheme: 'flying-money', v: 1, spec: '1.4.1', headers: { note: NOTE_HEADER } })
    expect(wk.accepts[0].chainId).toBe(String(CHAIN_ID))
    const oa = await (await oracle.app.request('http://oracle.test/openapi.json')).json()
    expect(oa.openapi).toMatch(/^3\./)
    expect(oa.paths['/v1/tea-price'].get.responses['402']).toBeDefined()

    expect((await oracle.app.request(`http://oracle.test/fm/redeemable/${id}`)).status).toBe(404)
    await pay('/v1/proverb', 5_000n)
    const red = await (await oracle.app.request(`http://oracle.test/fm/redeemable/${id}`)).json()
    expect(red).toMatchObject({ chainId: CHAIN_ID, state: { accepted: '5000', consumed: '5000', credit: '0' } })
    expect(red.note).toMatch(/^fm1\./)
  })

  it('emits accepted-note events for the demo stream', async () => {
    const { oracle, pay } = setup()
    const seen: unknown[] = []
    oracle.events.on('note', (e) => seen.push(e))
    await pay('/v1/proverb', 5_000n)
    expect(seen).toHaveLength(1)
    expect(seen[0]).toMatchObject({ path: '/v1/proverb', status: 'SERVED', price: '5000', consumed: '5000' })
  })
})
