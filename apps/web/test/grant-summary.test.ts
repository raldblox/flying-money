import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GrantSummary, grantSentence } from '../components/grant-summary'
import { dayLabel, parseAmount } from '../lib/fmt'
import { budgetState, ENDING_SOON_DAYS, STATUS_LABEL, TERMS } from '../lib/glossary'

// BUILD_SPEC §22.3–§22.5: one vocabulary, one budget sentence, honest about leftovers, readable dates and amounts.
const END = 1_792_800_000n // Fri 24 Oct 2026, 16:00 UTC

describe('the budget sentence (§22.4)', () => {
  it('says who, where, how much, until when, no early cancel, and that leftovers are taken back', () => {
    const s = grantSentence({ amount: 20_000_000n, seller: 'Lantern Café', user: 'Mia', expiresAt: END, test: true })
    expect(s).toContain('Up to 20.00 test USDC')
    expect(s).toContain('at Lantern Café')
    expect(s).toContain('used by Mia')
    expect(s).toMatch(/until \w{3} \d{1,2} Oct/)
    expect(s).toContain('can’t be cancelled early')
    expect(s).toContain('take back what’s left')
    // never the automatic-return promise
    expect(s.toLowerCase()).not.toMatch(/comes back|returns to you|automatic/)
  })

  it('from the holder’s side it names who can take the rest back', () => {
    const s = grantSentence({
      amount: 20_000_000n,
      seller: 'Lantern Café',
      user: 'you',
      expiresAt: END,
      test: false,
      perspective: 'holder',
      funder: 'Mum',
    })
    expect(s).toContain('Up to 20.00 USDC')
    expect(s).toContain('Mum can take back what’s left')
  })

  it('renders as one readable line', () => {
    const html = renderToStaticMarkup(
      createElement(GrantSummary, {
        amount: 5_000_000n,
        seller: 'Oracle',
        user: 'Research agent',
        expiresAt: END,
        test: true,
      }),
    )
    expect(html).toContain('Research agent')
    expect(html).toContain('can’t be cancelled early')
  })
})

describe('formatting and parsing (§22.5 h)', () => {
  it('dates use a month name', () => {
    expect(dayLabel(END)).toMatch(/^\w{3} \d{1,2} Oct$/)
  })
  it('amounts accept a decimal comma or point, up to 6 decimals, never floats', () => {
    expect(parseAmount('3,50')).toBe(3_500_000n)
    expect(parseAmount('3.50')).toBe(3_500_000n)
    expect(parseAmount(' 5 ')).toBe(5_000_000n)
    expect(parseAmount('0.000001')).toBe(1n)
    expect(parseAmount('1,000.50')).toBeNull()
    expect(parseAmount('1.0000001')).toBeNull()
    expect(parseAmount('abc')).toBeNull()
    expect(parseAmount('')).toBeNull()
  })
})

describe('one vocabulary (§22.3)', () => {
  it('uses the approved words', () => {
    expect(TERMS.budget).toBe('budget')
    expect(TERMS.collect).toBe('Collect')
    expect(TERMS.reclaim).toBe('Take back what’s left')
    expect(TERMS.fee).toBe('network fee')
  })
  it('one status map, "Ending soon" within 3 days', () => {
    expect(ENDING_SOON_DAYS).toBe(3)
    const now = 1_000_000_000n
    expect(budgetState({ closed: false, expiresAt: now + 10n * 86_400n }, now)).toBe('active')
    expect(budgetState({ closed: false, expiresAt: now + 2n * 86_400n + 3600n }, now)).toBe('ending')
    expect(budgetState({ closed: false, expiresAt: now - 1n }, now)).toBe('ended')
    expect(budgetState({ closed: true, expiresAt: now + 99n }, now)).toBe('closed')
    expect(Object.values(STATUS_LABEL)).toEqual(['Active', 'Ending soon', 'Ended', 'Closed'])
  })
})
