/// <reference lib="webworker" />
import { RECOVERY_TAG, runBackgroundRecovery } from '@flying-money/browser/background'

const worker = self as unknown as ServiceWorkerGlobalScope
let running: ReturnType<typeof runBackgroundRecovery> | undefined
const recover = () => {
  running ??= runBackgroundRecovery().finally(() => {
    running = undefined
  })
  return running
}

worker.addEventListener('sync', ((event: ExtendableEvent & { tag: string }) => {
  if (event.tag !== RECOVERY_TAG) return
  event.waitUntil(
    recover().then(async (result) => {
      for (const client of await worker.clients.matchAll()) client.postMessage({ type: 'FM_RECOVERED', ...result })
      if (result.waiting) throw new Error('Saved payments still need a network check.')
    }),
  )
}) as EventListener)

worker.addEventListener('message', (event) => {
  if (event.data?.type !== 'RECOVER_SAVED_PAYMENTS') return
  event.waitUntil(
    recover().then(
      (result) => event.ports[0]?.postMessage({ ok: true, ...result }),
      () => event.ports[0]?.postMessage({ ok: false }),
    ),
  )
})
