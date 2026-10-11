import 'fake-indexeddb/auto'
import { expect, it, vi } from 'vitest'
import { idbKV } from '../src/idb.js'

it('commits related records atomically and rolls back a failed mutation', async () => {
  const db = idbKV(crypto.randomUUID())
  await db.set('balance', '10')
  await expect(
    db.atomic((records) => {
      records.set('balance', '5')
      records.set('history', 'paid')
      throw new Error('interrupted')
    }),
  ).rejects.toThrow('interrupted')
  expect(await db.get('balance')).toBe('10')
  expect(await db.get('history')).toBeUndefined()
  await db.atomic((records) => {
    records.set('balance', '5')
    records.set('history', 'paid')
  })
  expect(await db.get('balance')).toBe('5')
  expect(await db.get('history')).toBe('paid')
})

it('serializes concurrent updates across independent repository handles', async () => {
  const name = crypto.randomUUID()
  const a = idbKV(name)
  const b = idbKV(name)
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      (i % 2 ? a : b).atomic((records) => {
        records.set('count', String(Number(records.get('count') ?? '0') + 1))
      }),
    ),
  )
  expect(await a.get('count')).toBe('20')
})

it('retries after an IndexedDB open failure instead of keeping a poisoned connection', async () => {
  const db = idbKV(crypto.randomUUID())
  vi.spyOn(indexedDB, 'open').mockImplementationOnce(() => {
    throw new DOMException('Unavailable', 'UnknownError')
  })
  await expect(db.set('pending', 'saved')).rejects.toThrow('Unavailable')
  await db.set('pending', 'saved')
  expect(await db.get('pending')).toBe('saved')
  vi.restoreAllMocks()
})
it('keeps the complete old state when a storage mutation fails', async () => {
  const db = idbKV(crypto.randomUUID())
  await db.set('pending', 'signed-payment')
  await expect(
    db.atomic((records) => {
      records.delete('pending')
      records.set('history', 'paid')
      throw new DOMException('Storage full', 'QuotaExceededError')
    }),
  ).rejects.toMatchObject({ name: 'QuotaExceededError' })
  expect(await db.get('pending')).toBe('signed-payment')
  expect(await db.get('history')).toBeUndefined()
})
