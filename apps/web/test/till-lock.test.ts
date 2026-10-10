import { afterEach, expect, it, vi } from 'vitest'
import { holdLock } from '../lib/till'

afterEach(() => vi.unstubAllGlobals())

it('refuses to open payment state without exclusive browser locks', async () => {
  vi.stubGlobal('navigator', {})
  await expect(holdLock('test-wallet', 1)).rejects.toThrow('exclusive')
})
