import type { Offer } from '@flying-money/core'
import { describe, expect, it } from 'vitest'
import {
  InsufficientBudgetError,
  NoCertificateError,
  PaymentRejectedError,
  PendingUnresolvedError,
  PriceTooHighError,
} from '../src/index.js'

// BUILD_SPEC §22.6: SDK errors carry a stable `code` and a `docUrl` (additive; names, messages and fields unchanged).
const offer = { price: 5n, accepts: [] } as unknown as Offer
const ID = `0x${'11'.repeat(32)}` as const

describe('SDK error codes (§22.6)', () => {
  it('every error has a stable code and a link to its explanation', () => {
    const cases: Array<[Error & { code: string; docUrl: string }, string]> = [
      [new NoCertificateError(offer), 'no_certificate'],
      [new PriceTooHighError(offer, 1n), 'price_too_high'],
      [new InsufficientBudgetError(ID, 2n, 1n), 'insufficient_budget'],
      [new PaymentRejectedError(402, 'insufficient', ''), 'payment_rejected'],
      [new PendingUnresolvedError(ID), 'pending_unresolved'],
    ]
    for (const [e, code] of cases) {
      expect(e.code).toBe(code)
      expect(e.docUrl).toMatch(new RegExp(`/docs/agents#${code.replace(/_/g, '-')}$`))
      expect(e).toBeInstanceOf(Error)
    }
  })
  it('names and fields are unchanged', () => {
    const e = new PriceTooHighError(offer, 1n)
    expect(e.name).toBe('PriceTooHighError')
    expect(e.max).toBe(1n)
  })
})
