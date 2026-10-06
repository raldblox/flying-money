import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { describe, expect, it } from 'vitest'
import {
  type CarryContext,
  counterRequestId,
  decodeNoteCompact,
  decodeOfferCompact,
  encodeNoteCompact,
  encodeOfferCompact,
  frameCollector,
  type Hex,
  type Offer,
  recoverNoteSigner,
  signNote,
  toFrames,
} from '../src/index.js'

// protocol.md "Carriers": compact forms decode to exactly the same signed objects; frames carry them in small pieces.
const CONTRACT: Hex = '0x00000000000000000000000000000000000f1f1f'
const TOKEN: Hex = '0x00000000000000000000000000000000000C0c0C'
const ctx: CarryContext = (id) => (id === 31337 ? { contract: CONTRACT, token: TOKEN } : undefined)
const agent = privateKeyToAccount(generatePrivateKey())
const slip = (cumulative = 10_000n, order = 'o-1') =>
  signNote(agent, 31337, CONTRACT, { certificateId: `0x${'ab'.repeat(32)}`, cumulative, memo: counterRequestId(order) })

describe('carrying slips (compact forms and frames)', () => {
  it('a slip round-trips with its memo, and still recovers the same signer', async () => {
    const n = await slip(987_654_321n)
    const back = decodeNoteCompact(encodeNoteCompact(n, ctx)!, ctx)
    expect(back).toEqual(n)
    expect(recoverNoteSigner(back)?.toLowerCase()).toBe(agent.address.toLowerCase())
  })

  it('a till slip leaves out the memo; only the order it belongs to can read it', async () => {
    const n = await slip(10_000n, 'o-42')
    const c = encodeNoteCompact(n, ctx, { withMemo: false })!
    expect(() => decodeNoteCompact(c, ctx)).toThrow(/till that asked/)
    expect(decodeNoteCompact(c, ctx, { memo: counterRequestId('o-42') })).toEqual(n)
  })

  it('never compacts what it would change, and refuses chains it doesn’t know', async () => {
    const n = await slip()
    expect(encodeNoteCompact({ ...n, contract: TOKEN }, ctx)).toBeNull()
    expect(encodeNoteCompact({ ...n, cumulative: 2n ** 64n }, ctx)).toBeNull()
    expect(encodeNoteCompact({ ...n, chainId: 1 }, ctx)).toBeNull()
    const c = encodeNoteCompact(n, ctx)!
    expect(() => decodeNoteCompact(c, () => undefined)).toThrow(/no Flying Money deployment/)
    expect(() => decodeNoteCompact(`${c.slice(0, -4)}AAAA`, ctx)).not.toThrow() // decodes, but…
    expect(recoverNoteSigner(decodeNoteCompact(`${c.slice(0, -4)}AAAA`, ctx))?.toLowerCase()).not.toBe(
      agent.address.toLowerCase(),
    ) // …a damaged signature no longer recovers the agent
  })

  it('a price code round-trips', () => {
    const o: Offer = {
      scheme: 'flying-money',
      v: 1,
      price: 10_000n,
      minRemainingLifetime: 129_600,
      memoHint: 'ord-k3x9',
      accepts: [{ chainId: 31337, contract: CONTRACT, token: TOKEN, payee: agent.address }],
    }
    expect(decodeOfferCompact(encodeOfferCompact(o, ctx)!, ctx)).toEqual(o)
  })

  it('frames split a payload for small carriers and reassemble in any order, repeats included', async () => {
    const text = encodeNoteCompact(await slip(), ctx)!
    for (const max of [23, 40, 140]) {
      const frames = toFrames(text, max)
      for (const f of frames) expect(f.length).toBeLessThanOrEqual(max)
      const collect = frameCollector()
      let whole: string | undefined
      for (const f of [...frames.slice(1), frames[0]!, frames[0]!].reverse()) whole = collect(f)?.text ?? whole
      expect(whole).toBe(text)
    }
    expect(frameCollector()('not a frame')).toBeNull()
  })
})
