import type { Hex } from 'viem'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import {
  newRequestId,
  type Offer,
  type Receipt,
  signNote,
  X402_SCHEME,
  x402Network,
  x402NoteFromPayload,
  x402OfferFromRequired,
  x402PaymentPayload,
  x402PaymentRequired,
  x402ReceiptFromResponse,
  x402SettlementResponse,
} from '../src/index.js'

// x402 transport for Flying Money (docs/design/x402-flying-money-scheme.md): the same offer, slip and receipt carried
// in x402 V2 headers. Nothing economic changes, so parsing is strict and round-trips exactly.
const contract = '0xb9ae3158f9cA841d9Da3C3725014D8352ca967F2' as Hex
const token = '0x00000000000000000000000000000000000c0c0c' as Hex
const payee = '0xE828e7031b6Ed8F9525e5060101746adA6a653d2' as Hex
const offer: Offer = {
  scheme: 'flying-money',
  v: 1,
  price: 10_000n,
  minRemainingLifetime: 3600,
  suggestedFaceValue: 500_000n,
  accepts: [
    { chainId: 421614, contract, token, payee },
    { chainId: 84532, contract, token, payee },
  ],
}
const resource = { url: 'https://oracle.example/v1/tea-price?city=Luoyang', mimeType: 'application/json' }
const b64json = (h: string) => JSON.parse(atob(h)) as Record<string, any>

describe('x402 V2 transport for the flying-money scheme', () => {
  it('advertises one accepts entry per chain, in x402 V2 shape', () => {
    const pr = b64json(x402PaymentRequired(offer, resource, 'payment required'))
    expect(pr.x402Version).toBe(2)
    expect(pr.resource).toEqual(resource)
    expect(pr.error).toBe('payment required')
    expect(pr.accepts).toHaveLength(2)
    expect(pr.accepts[0]).toEqual({
      scheme: X402_SCHEME,
      network: 'eip155:421614',
      amount: '10000',
      asset: token,
      payTo: payee,
      maxTimeoutSeconds: 300,
      extra: { contract, minRemainingLifetime: 3600, suggestedFaceValue: '500000' },
    })
  })

  it('round-trips an offer exactly', () => {
    expect(x402OfferFromRequired(x402PaymentRequired(offer, resource))).toEqual(offer)
  })

  it('ignores other schemes and refuses inconsistent or malformed entries', () => {
    const pr = b64json(x402PaymentRequired(offer, resource))
    const enc = (o: unknown) => btoa(JSON.stringify(o))
    const exact = { ...pr.accepts[0], scheme: 'exact', extra: { name: 'USDC', version: '2' } }
    // an x402 seller that also takes `exact`: we read only our entries
    expect(x402OfferFromRequired(enc({ ...pr, accepts: [exact, ...pr.accepts] }))).toEqual(offer)
    // nothing for us
    expect(x402OfferFromRequired(enc({ ...pr, accepts: [exact] }))).toBeNull()
    // one price per offer: different amounts across chains are refused
    expect(() =>
      x402OfferFromRequired(enc({ ...pr, accepts: [pr.accepts[0], { ...pr.accepts[1], amount: '1' }] })),
    ).toThrow()
    expect(() => x402OfferFromRequired(enc({ ...pr, x402Version: 1 }))).toThrow()
    expect(() => x402OfferFromRequired(enc({ ...pr, accepts: [{ ...pr.accepts[0], network: 'base' }] }))).toThrow()
    expect(() => x402OfferFromRequired(enc({ ...pr, accepts: [{ ...pr.accepts[0], payTo: '0x12' }] }))).toThrow()
    expect(() => x402OfferFromRequired('not base64 !')).toThrow()
    expect(() => x402OfferFromRequired('A'.repeat(20_000))).toThrow()
  })

  it('carries the signed slip unchanged, and checks it matches the chosen entry', async () => {
    const spender = privateKeyToAccount(generatePrivateKey())
    const note = await signNote(spender, 421614, contract, {
      certificateId: `0x${'ab'.repeat(32)}` as Hex,
      cumulative: 30_000n,
      memo: newRequestId(),
    })
    const pr = b64json(x402PaymentRequired(offer, resource))
    const header = x402PaymentPayload(note, pr.accepts[0], resource)
    const pp = b64json(header)
    expect(pp.x402Version).toBe(2)
    expect(pp.accepted).toEqual(pr.accepts[0])
    expect(x402NoteFromPayload(header)).toEqual(note)
    // the entry chosen must be the slip's own chain and contract
    expect(() => x402PaymentPayload(note, pr.accepts[1], resource)).toThrow()
    const tampered = btoa(JSON.stringify({ ...pp, accepted: pr.accepts[1] }))
    expect(() => x402NoteFromPayload(tampered)).toThrow()
    expect(() => x402NoteFromPayload(btoa(JSON.stringify({ ...pp, payload: { ...pp.payload, extra: 1 } })))).toThrow()
    expect(() =>
      x402NoteFromPayload(btoa(JSON.stringify({ ...pp, accepted: { ...pp.accepted, scheme: 'exact' } }))),
    ).toThrow()
  })

  it('reports settlement without claiming an on-chain transaction, and carries the receipt', () => {
    const receipt: Receipt = {
      certificateId: `0x${'ab'.repeat(32)}` as Hex,
      requestId: newRequestId(),
      status: 'SERVED',
      accepted: 30_000n,
      consumed: 30_000n,
      reserved: 0n,
      credit: 0n,
      remaining: 470_000n,
      expiresAt: 1_800_000_000n,
    }
    const sr = b64json(x402SettlementResponse(receipt, 421614, payee))
    expect(sr).toMatchObject({ success: true, transaction: '', network: 'eip155:421614', payer: payee })
    expect(x402ReceiptFromResponse(x402SettlementResponse(receipt, 421614, payee))).toEqual(receipt)
    const failed = b64json(x402SettlementResponse({ ...receipt, status: 'FAILED_CREDITED' }, 421614, payee))
    expect(failed.success).toBe(false)
    expect(failed.errorReason).toBe('service_failed_credited')
    expect(x402Network(84532)).toBe('eip155:84532')
  })
})
