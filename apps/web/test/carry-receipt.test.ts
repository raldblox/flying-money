import { expect, it } from 'vitest'
import { decodeReceipt, encodeReceipt, receiptFor } from '@/lib/carry/receipt'

const memo = `0x${'ab12'.repeat(16)}` as const
const cert = `0x${'cd34'.repeat(16)}` as const

it('a receipt round-trips small enough for one QR code, and answers only its own payment', () => {
  const text = encodeReceipt({
    memo,
    certificate: cert,
    price: 10_000n,
    status: 'GUARANTEED',
    item: 'A 飛錢 certificate',
    keepsake: { serial: 'AB12AB12', name: 'Mia', issuedAt: '2026-10-06T01:01:00.000Z', proverb: 3, chainId: 84532 },
  })
  expect(text.length).toBeLessThan(400)
  const r = decodeReceipt(text)!
  expect(r).toMatchObject({ price: 10_000n, status: 'GUARANTEED', item: 'A 飛錢 certificate' })
  expect(r.keepsake).toMatchObject({ name: 'Mia', proverb: 3, chainId: 84532 })
  expect(receiptFor(r, memo, cert)).toBe(true)
  expect(receiptFor(r, `0x${'ff'.repeat(32)}`, cert)).toBe(false)
  expect(receiptFor(r, memo, `0x${'ff'.repeat(32)}`)).toBe(false)
  expect(decodeReceipt('fm2r.not-json')).toBeNull()
  expect(decodeReceipt('fm2n.something')).toBeNull()
})
