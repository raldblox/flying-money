export type RecoveryState = 'checking' | 'current' | 'waiting'

/**
 * Runs an idempotent recovery adapter while its owner is alive. The adapter returns true if work remains.
 * This scheduler never signs, sends a new payment, clears an outbox, or decides whether funds settled.
 * Stop prevents new work; callers must retain storage ownership until an in-flight adapter finishes.
 */
export function createRecovery(options: {
  reconcile(): Promise<boolean>
  onState?(state: RecoveryState): void
  retryMs?: number
  maxRetryMs?: number
}) {
  let stopped = false
  let running: Promise<void> | undefined
  let wakeAgain = false
  let timer: ReturnType<typeof setTimeout> | undefined
  let delay = options.retryMs ?? 2_000
  const initialDelay = delay
  const maxDelay = options.maxRetryMs ?? 60_000
  const state = (value: RecoveryState) => {
    if (!stopped) options.onState?.(value)
  }
  const wake = (): Promise<void> => {
    if (stopped) return Promise.resolve()
    if (running) {
      wakeAgain = true
      return running
    }
    clearTimeout(timer)
    running = Promise.resolve()
      .then(async () => {
        state('checking')
        let pending = true
        try {
          pending = await options.reconcile()
        } catch {
          /* retry failures without losing durable work */
        }
        if (stopped) return
        state(pending ? 'waiting' : 'current')
        if (pending) {
          timer = setTimeout(() => {
            void wake()
          }, delay)
          delay = Math.min(maxDelay, delay * 2)
        } else delay = initialDelay
      })
      .finally(() => {
        running = undefined
        if (wakeAgain && !stopped) {
          wakeAgain = false
          void wake()
        }
      })
    return running
  }
  return {
    wake,
    async stop() {
      stopped = true
      clearTimeout(timer)
      await running
    },
  }
}

/** Lifecycle adapter for an open browser page, including devices resuming from sleep. */
export function recoverWhileOpen(options: Parameters<typeof createRecovery>[0]) {
  const recovery = createRecovery(options)
  const wake = () => {
    void recovery.wake()
  }
  const visible = () => {
    if (document.visibilityState === 'visible') wake()
  }
  window.addEventListener('online', wake)
  window.addEventListener('focus', wake)
  document.addEventListener('visibilitychange', visible)
  wake()
  return async () => {
    window.removeEventListener('online', wake)
    window.removeEventListener('focus', wake)
    document.removeEventListener('visibilitychange', visible)
    await recovery.stop()
  }
}
