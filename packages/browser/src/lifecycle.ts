/** Drains started operations before their owner releases a lock. No new operation can enter after close. */
export function operationScope() {
  let closing = false
  const pending = new Set<Promise<unknown>>()
  return {
    run<T>(operation: () => Promise<T>): Promise<T> {
      if (closing) return Promise.reject(new Error('This wallet or till is closed. Reopen it to continue.'))
      let promise: Promise<T>
      try {
        promise = operation()
      } catch (error) {
        return Promise.reject(error)
      }
      pending.add(promise)
      void promise.then(
        () => pending.delete(promise),
        () => pending.delete(promise),
      )
      return promise
    },
    async close() {
      closing = true
      await Promise.allSettled([...pending])
    },
  }
}
