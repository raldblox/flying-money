import { afterEach, expect, it, vi } from 'vitest'
import { createRecovery } from '../src/recovery.js'

afterEach(() => vi.useRealTimers())

it('serializes repeated wakes and retries pending work with a bounded delay', async () => {
  vi.useFakeTimers()
  let finish!: (value: boolean) => void
  const reconcile = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((r) => {
          finish = r
        }),
    )
    .mockResolvedValue(false)
  const recovery = createRecovery({ reconcile, retryMs: 100 })
  const first = recovery.wake()
  const second = recovery.wake()
  await Promise.resolve()
  expect(reconcile).toHaveBeenCalledTimes(1)
  finish(true)
  await Promise.all([first, second])
  await vi.advanceTimersByTimeAsync(100)
  expect(reconcile).toHaveBeenCalledTimes(2)
  await vi.advanceTimersByTimeAsync(60_000)
  expect(reconcile).toHaveBeenCalledTimes(2)
  await recovery.stop()
})

it('recovers after errors and cancels scheduled retries on stop', async () => {
  vi.useFakeTimers()
  const reconcile = vi.fn().mockRejectedValue(new Error('RPC unavailable'))
  const onState = vi.fn()
  const recovery = createRecovery({ reconcile, onState, retryMs: 100, maxRetryMs: 200 })
  await recovery.wake()
  expect(onState).toHaveBeenLastCalledWith('waiting')
  await vi.advanceTimersByTimeAsync(300)
  expect(reconcile).toHaveBeenCalledTimes(3)
  await recovery.stop()
  await vi.advanceTimersByTimeAsync(1_000)
  await recovery.wake()
  expect(reconcile).toHaveBeenCalledTimes(3)
})

it('drains in-flight recovery before releasing ownership and suppresses late notifications', async () => {
  let finish!: (value: boolean) => void
  const onState = vi.fn()
  const recovery = createRecovery({
    reconcile: () =>
      new Promise<boolean>((r) => {
        finish = r
      }),
    onState,
  })
  const work = recovery.wake()
  await Promise.resolve()
  let drained = false
  const stop = recovery.stop().then(() => {
    drained = true
  })
  await Promise.resolve()
  expect(drained).toBe(false)
  finish(true)
  await Promise.all([work, stop])
  expect(drained).toBe(true)
  expect(onState.mock.calls).toEqual([['checking']])
})

it('does not lose work created while the previous pass is finishing', async () => {
  let finish!: (value: boolean) => void
  const reconcile = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          finish = resolve
        }),
    )
    .mockResolvedValue(false)
  const recovery = createRecovery({ reconcile })
  const first = recovery.wake()
  await Promise.resolve()
  void recovery.wake()
  finish(false)
  await first
  await Promise.resolve()
  expect(reconcile).toHaveBeenCalledTimes(2)
  await recovery.stop()
})
