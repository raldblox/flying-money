import { describe, expect, it } from 'vitest'
import { type DemoEvent, illustrationScript, initialStory, money, reduceStory } from '../lib/demo-story'

const play = (events: DemoEvent[]) => events.reduce(reduceStory, initialStory)

describe('demo story', () => {
  it('money() formats base units for display', () => {
    expect(money(250_000n)).toBe('0.25')
    expect(money(5_000n)).toBe('0.005')
    expect(money(1_000_000n)).toBe('1.00')
    expect(money(0n)).toBe('0.00')
  })

  it('the illustration adds up exactly like the live run: 20 calls, 0.25 served and collected, 0.05 back', () => {
    for (const cutNetwork of [false, true])
      for (const stealKey of [false, true]) {
        const s = play(illustrationScript({ cutNetwork, stealKey }))
        expect(s.phase).toBe('done')
        expect(s.calls).toBe(20)
        expect(s.served).toBe(250_000n)
        expect(s.collected).toBe(250_000n)
        expect(s.signed).toBe(250_000n)
        expect(s.done?.remaining).toBe('50000')
        // every call is collected exactly once, in order
        expect(s.collections.flatMap((c) => [c.from, c.to])[0]).toBe(1)
        expect(s.collections.at(-1)?.to).toBe(20)
        for (let i = 1; i < s.collections.length; i++) expect(s.collections[i]!.from).toBe(s.collections[i - 1]!.to + 1)
        expect(s.collections.reduce((t, c) => t + c.paid, 0n)).toBe(250_000n)
        expect(s.thief).toHaveLength(stealKey ? 3 : 0)
        expect(s.network).toBe('up')
        // never presented as real: no transaction links
        expect(s.collections.every((c) => !c.txUrl)).toBe(true)
      }
  })

  it('a network cut shows as down until restored, and the restore collects the queued calls in one go', () => {
    const ev = illustrationScript({ cutNetwork: true, stealKey: false })
    let s = initialStory
    let sawDown = false
    for (const e of ev) {
      s = reduceStory(s, e)
      if (s.network === 'down') {
        sawDown = true
        expect(s.caption.tone === 'amber' || e.type === 'sealed' || e.type === 'step').toBe(true)
      }
    }
    expect(sawDown).toBe(true)
    const restore = play(ev.slice(0, ev.findIndex((e) => e.type === 'network' && !e.down) + 2))
    expect(restore.collections.at(-1)?.to).toBe(12)
  })

  it('thief attempts are explained in plain words, in the live run order', () => {
    const s = play([
      { type: 'start', chain: 'x', chainName: 'X', explorer: '', face: '300000' },
      { type: 'thief', attempt: 'raw', refused: true, detail: 'HTTP 402 insufficient' },
      { type: 'thief', attempt: 'raw', refused: true, detail: 'ExceedsFaceValue' },
      { type: 'thief', attempt: 'raw', refused: true, detail: 'HTTP 402 wrong-payee' },
    ])
    expect(s.thief.map((t) => t.target)).toEqual(['seller', 'contract', 'other-seller'])
    expect(s.thief.every((t) => t.refused)).toBe(true)
    expect(s.caption.detail).toMatch(/only ever pay the Silk Road Oracle/)
  })

  it('flights are bounded so a long run never piles up DOM nodes', () => {
    const s = play(illustrationScript({ cutNetwork: false, stealKey: false }))
    expect(s.flights.length).toBeLessThanOrEqual(8)
  })
})
