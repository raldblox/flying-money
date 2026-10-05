import { getChain } from '@flying-money/chains'
import { counterRequestId, encodeHeader, type Offer, recoverNoteSigner, signNote } from '@flying-money/core'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import { carryLink, decodeCarried, decodeNoteCompact, encodeNoteCompact, encodeOfferCompact } from '@/lib/carry/codec'

// Compact slips and price codes for small carriers (sound, NFC, dense QR) decode to exactly the same payment.
const arb = getChain('arbitrum-sepolia')
const contract = arb.flyingMoney!
const agent = privateKeyToAccount(generatePrivateKey())

async function slip(cumulative = 10_000n, orderId = 'order-1') {
  return signNote(agent, arb.chain.id, contract, {
    certificateId: `0x${'ab'.repeat(32)}`,
    cumulative,
    memo: counterRequestId(orderId),
  })
}

describe('compact carriers codec', () => {
  it('a slip round-trips with its memo, and still recovers the same signer', async () => {
    const n = await slip(123_456_789n)
    const c = encodeNoteCompact(n)!
    expect(c.length).toBeLessThan(200)
    const back = decodeNoteCompact(c)
    expect(back).toEqual(n)
    expect(recoverNoteSigner(back)?.toLowerCase()).toBe(agent.address.toLowerCase())
  })

  it('a till slip can leave out the memo; only the till that knows the order can read it', async () => {
    const n = await slip(10_000n, 'order-42')
    const c = encodeNoteCompact(n, { withMemo: false })!
    expect(c.length).toBeLessThanOrEqual(152)
    expect(() => decodeNoteCompact(c)).toThrow(/till that asked/)
    expect(decodeNoteCompact(c, { memo: counterRequestId('order-42') })).toEqual(n)
  })

  it('refuses to compact what it would change: another contract, or an amount past 64 bits', async () => {
    const n = await slip()
    expect(encodeNoteCompact({ ...n, contract: '0x0000000000000000000000000000000000000001' })).toBeNull()
    expect(encodeNoteCompact({ ...n, cumulative: 2n ** 64n })).toBeNull()
  })

  it('a tampered slip decodes but no longer recovers the agent', async () => {
    const n = await slip()
    const c = encodeNoteCompact(n)!
    const back = decodeNoteCompact(c)
    expect(recoverNoteSigner({ ...back, cumulative: back.cumulative + 1n })?.toLowerCase()).not.toBe(
      agent.address.toLowerCase(),
    )
  })

  it('a price code round-trips', () => {
    const o: Offer = {
      scheme: 'flying-money',
      v: 1,
      price: 10_000n,
      minRemainingLifetime: 129_600,
      memoHint: 'ord-k3x9',
      accepts: [{ chainId: arb.chain.id, contract, token: arb.usdc, payee: agent.address }],
    }
    const c = encodeOfferCompact(o)!
    expect(c.length).toBeLessThan(80)
    expect(decodeCarried(c)).toEqual({ kind: 'offer', offer: o })
  })

  it('reads both forms, bare or inside a link', async () => {
    const n = await slip()
    const fm1 = encodeHeader(n)
    const fm2 = encodeNoteCompact(n)!
    for (const t of [fm1, fm2, carryLink('https://x.test/', fm2), `https://x.test/carry?c=${fm2}`])
      expect(decodeCarried(t)).toEqual({ kind: 'note', note: n })
    expect(() => decodeCarried('hello')).toThrow(/isn’t a Flying Money/)
  })
})
