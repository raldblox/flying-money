import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import {
  decodeSpendRequest,
  encodeSpendRequest,
  type Hex,
  newRequestId,
  recoverNoteSigner,
  type SignedSpendRequest,
  signSpendRequest,
  verifySpendRequest,
  ZERO_ID,
} from '../src/index.js'

const agent = privateKeyToAccount(generatePrivateKey())
const owner = privateKeyToAccount(generatePrivateKey()).address
const payee = privateKeyToAccount(generatePrivateKey()).address
const CHAIN = 421614

const base = () => ({
  owner,
  payee,
  amount: 500_000n,
  validFor: 3n * 86_400n,
  certificateId: ZERO_ID,
  requestId: newRequestId(),
  createdAt: 1_790_000_000n,
  reason: 'Tea prices for the Luoyang trip',
  origin: 'https://flying-money-oracle.vercel.app',
})

// §21.4.6 tests: signatures, strict parsing, domain separation.
describe('spend requests (§21.4.1)', () => {
  it('sign → encode → decode → verify; the requester is the signing key', async () => {
    const s = await signSpendRequest(agent, CHAIN, base())
    expect(s.request.requester).toBe(agent.address)
    const back = decodeSpendRequest(encodeSpendRequest(s))
    expect(back).toEqual(s)
    expect(verifySpendRequest(back)).toBe(true)
  })

  it('tampering with any field, the chain, or signing with another key fails verification', async () => {
    const s = await signSpendRequest(agent, CHAIN, base())
    const tampered: Array<SignedSpendRequest> = [
      { ...s, request: { ...s.request, amount: 5_000_000n } },
      { ...s, request: { ...s.request, payee: owner } },
      { ...s, request: { ...s.request, owner: payee } },
      { ...s, request: { ...s.request, reason: 'something else' } },
      { ...s, chainId: 1 },
      { ...s, request: { ...s.request, requester: privateKeyToAccount(generatePrivateKey()).address } },
    ]
    for (const t of tampered) expect(verifySpendRequest(t)).toBe(false)
  })

  it('domain separation (R, §21.4.6): a request signature is never a valid payment note', async () => {
    const s = await signSpendRequest(agent, CHAIN, base())
    // reinterpret the request's signature as a Note for any plausible contract/certificate
    for (const contract of [payee, owner, `0x${'0'.repeat(40)}` as Hex])
      for (const certificateId of [s.request.certificateId, s.request.requestId]) {
        const signer = recoverNoteSigner({
          chainId: CHAIN,
          contract,
          certificateId,
          cumulative: s.request.amount,
          memo: s.request.requestId,
          sig: s.sig,
        })
        expect(signer?.toLowerCase()).not.toBe(agent.address.toLowerCase())
      }
  })

  it('strict parsing: unknown fields, short lifetimes, long text and self-requests are rejected', async () => {
    const s = await signSpendRequest(agent, CHAIN, base())
    const raw = JSON.parse(atob(encodeSpendRequest(s).slice(4).replace(/-/g, '+').replace(/_/g, '/')))
    const enc = (o: unknown) =>
      `fm1.${btoa(unescape(encodeURIComponent(JSON.stringify(o))))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '')}`
    expect(() => decodeSpendRequest(enc({ ...raw, extra: 1 }))).toThrow(/unknown field/)
    expect(() => decodeSpendRequest(enc({ ...raw, request: { ...raw.request, validFor: '3600' } }))).toThrow(/one day/)
    expect(() => decodeSpendRequest(enc({ ...raw, request: { ...raw.request, reason: 'x'.repeat(281) } }))).toThrow(
      /280/,
    )
    expect(() => decodeSpendRequest(enc({ ...raw, request: { ...raw.request, amount: '0' } }))).toThrow(/positive/)
    expect(() => decodeSpendRequest(enc({ ...raw, type: 'Note' }))).toThrow(/SpendRequest/)
    await expect(signSpendRequest(agent, CHAIN, { ...base(), owner: agent.address })).rejects.toThrow(/owner/)
    await expect(signSpendRequest(agent, CHAIN, { ...base(), payee: agent.address })).rejects.toThrow(/payee/)
  })

  it('a 280-character reason in any script still fits a link (≤ 4 KB)', async () => {
    const s = await signSpendRequest(agent, CHAIN, { ...base(), reason: '飛'.repeat(280) })
    const link = encodeSpendRequest(s)
    expect(link.length).toBeLessThanOrEqual(4096)
    expect(verifySpendRequest(decodeSpendRequest(link))).toBe(true)
  })
})
