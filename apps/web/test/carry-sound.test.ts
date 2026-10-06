import { getChain } from '@flying-money/chains'
import { counterRequestId, recoverNoteSigner, signNote } from '@flying-money/core'
import factory from 'ggwave'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { expect, it } from 'vitest'
import { decodeCarried, encodeNoteCompact } from '@/lib/carry/codec'
import { chunkCollector, FRAME, toChunks } from '@/lib/carry/sound'

type GG = {
  getDefaultParameters(): Record<string, number>
  init(p: unknown): number
  encode(i: number, t: string, p: number, v: number): Int8Array
  decode(i: number, d: Int8Array): Int8Array | null
  disableLog(): void
  ProtocolId: Record<string, number>
}

// A real slip goes through actual ggwave audio (encoded to a waveform, decoded back), in chunks, out of order.
it('a slip survives the sound carrier: chunked chirps, decoded, reassembled, still signed by the agent', async () => {
  const arb = getChain('arbitrum-sepolia')
  const agent = privateKeyToAccount(generatePrivateKey())
  const n = await signNote(agent, arb.chain.id, arb.flyingMoney!, {
    certificateId: `0x${'cd'.repeat(32)}`,
    cumulative: 10_000n,
    memo: counterRequestId('visitor-7'),
  })
  const text = encodeNoteCompact(n)!
  const chunks = toChunks(text)
  for (const c of chunks) expect(c.length).toBeLessThanOrEqual(FRAME)

  const g = (await factory()) as GG
  g.disableLog()
  const inst = g.init(g.getDefaultParameters())
  // copy each result at once: ggwave returns a view into its own memory, which the next decode overwrites
  const heard = chunks.map((c) => {
    const r = g.decode(inst, g.encode(inst, c, g.ProtocolId.GGWAVE_PROTOCOL_AUDIBLE_FASTEST!, 25))!
    return new TextDecoder().decode(new Uint8Array(r.buffer, r.byteOffset, r.byteLength).slice())
  })
  const collect = chunkCollector()
  let whole: string | undefined
  for (const h of [...heard].reverse()) whole = collect(h)?.text ?? whole
  expect(whole).toBe(text)
  const back = decodeCarried(whole!)
  expect(back.kind).toBe('note')
  if (back.kind === 'note') expect(recoverNoteSigner(back.note)?.toLowerCase()).toBe(agent.address.toLowerCase())
})

it('the ultrasound band carries the same frames', async () => {
  const g = (await factory()) as GG
  g.disableLog()
  const inst = g.init(g.getDefaultParameters())
  for (const frame of toChunks(`fm2o.${'Q'.repeat(60)}`)) {
    const r = g.decode(inst, g.encode(inst, frame, g.ProtocolId.GGWAVE_PROTOCOL_ULTRASOUND_FASTEST!, 25))!
    expect(new TextDecoder().decode(new Uint8Array(r.buffer, r.byteOffset, r.byteLength).slice())).toBe(frame)
  }
})

it('the sound library needs no eval, so it runs under the strict CSP of the wallet and till (patches/ggwave)', async () => {
  const { readFileSync } = await import('node:fs')
  const { createRequire } = await import('node:module')
  const src = readFileSync(createRequire(import.meta.url).resolve('ggwave'), 'utf8')
  expect(src).not.toMatch(/new Function\(|[^\w.]eval\(/)
})
