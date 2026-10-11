import { expect, it } from 'vitest'
import { preparedDelivery } from '../src/carry/delivery.js'

it('retries the exact saved bytes after an interrupted transport and respects cancellation', async () => {
  const payment = preparedDelivery('saved-signed-note')
  const seen: string[] = []
  await expect(
    payment.send({
      send: async (payload) => {
        seen.push(payload)
        throw new Error('lost')
      },
    }),
  ).rejects.toThrow('lost')
  expect(
    await payment.send({
      send: async (payload) => {
        seen.push(payload)
        return 'unacknowledged'
      },
    }),
  ).toBe('unacknowledged')
  expect(seen).toEqual(['saved-signed-note', 'saved-signed-note'])
  const controller = new AbortController()
  controller.abort()
  await expect(
    payment.send(
      {
        send: async () => {
          throw new Error('must not send')
        },
      },
      controller.signal,
    ),
  ).rejects.toMatchObject({ name: 'AbortError' })
})
