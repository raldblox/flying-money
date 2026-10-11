import { expect, it } from 'vitest'
import { operationScope } from '../src/lifecycle.js'

it('retains ownership until accepted work drains and refuses new work during close', async () => {
  const scope = operationScope()
  let finish!: () => void
  const payment = scope.run(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve
      }),
  )
  let released = false
  const closed = scope.close().then(() => {
    released = true
  })
  await expect(scope.run(async () => {})).rejects.toThrow('closed')
  expect(released).toBe(false)
  finish()
  await Promise.all([payment, closed])
  expect(released).toBe(true)
})
