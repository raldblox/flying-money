import { certKey, newRequestId } from '@flying-money/core'
import { expect, it, vi } from 'vitest'
import { reconcileRedemptions } from '../src/reconcile-redemptions.js'
import { CHAIN_ID } from './fixtures.js'

it('records only observed chain values, never a submitted batch amount', async () => {
  const a = certKey(CHAIN_ID, newRequestId())
  const b = certKey(CHAIN_ID, newRequestId())
  const markRedeemed = vi.fn()
  const readRedeemed = vi.fn().mockResolvedValueOnce(10n).mockResolvedValueOnce(0n)
  const result = await reconcileRedemptions({ markRedeemed }, [a, b], readRedeemed)
  expect(markRedeemed.mock.calls.map(([key, value]) => [key, value])).toEqual([
    [a, 10n],
    [b, 0n],
  ])
  expect(result.waiting).toBe(0)
})

it('preserves unresolved records on RPC failures and continues checking other budgets', async () => {
  const a = certKey(CHAIN_ID, newRequestId())
  const b = certKey(CHAIN_ID, newRequestId())
  const markRedeemed = vi.fn()
  const readRedeemed = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(5n)
  expect(await reconcileRedemptions({ markRedeemed }, [a, b], readRedeemed)).toEqual({ checked: 1, waiting: 1 })
  expect(markRedeemed).toHaveBeenCalledTimes(1)
  expect(markRedeemed.mock.calls[0]?.slice(0, 2)).toEqual([b, 5n])
})
