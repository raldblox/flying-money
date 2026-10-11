import { expect, it } from 'vitest'
import { demoCollectionsFromEnv } from '@/lib/demo-collections'

it('claims a collection once and preserves its hash for a lost-response recovery', async () => {
  const records = demoCollectionsFromEnv({})!
  const id = crypto.randomUUID()
  expect(await records.claim(id)).toBe(true)
  expect(await records.claim(id)).toBe(false)
  expect(await records.read(id)).not.toHaveProperty('hash')
  const hash = `0x${'11'.repeat(32)}` as const
  await records.submitted(id, hash)
  expect(await demoCollectionsFromEnv({})!.read(id)).toMatchObject({ hash })
  expect(await records.claim(id)).toBe(false)
})
it('requires durable recovery storage on Vercel', () => {
  expect(demoCollectionsFromEnv({ VERCEL: '1' })).toBeNull()
})
