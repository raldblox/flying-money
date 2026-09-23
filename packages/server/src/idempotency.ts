import type { Hex } from '@flying-money/core'
import type { AppStatus } from './server.js'

/**
 * Helper for making application side effects idempotent on requestId (§6.5 step 8, S1) and able to report
 * their status to the sweeper. In-memory: a multi-instance seller should back this with its own database.
 */
export function createIdempotency() {
  const jobs = new Map<string, { status: AppStatus; promise: Promise<unknown> }>()
  return {
    runOnce<T>(requestId: Hex, fn: () => Promise<T>): Promise<T> {
      const id = requestId.toLowerCase()
      const existing = jobs.get(id)
      if (existing) return existing.promise as Promise<T>
      const entry = { status: 'running' as AppStatus, promise: Promise.resolve() as Promise<unknown> }
      entry.promise = fn().then(
        (v) => {
          entry.status = 'done'
          return v
        },
        (e) => {
          entry.status = 'failed'
          throw e
        },
      )
      jobs.set(id, entry)
      return entry.promise as Promise<T>
    },
    status(requestId: Hex): AppStatus {
      return jobs.get(requestId.toLowerCase())?.status ?? 'not-started'
    },
  }
}
