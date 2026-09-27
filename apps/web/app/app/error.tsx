'use client'
import { useEffect } from 'react'

/** A page failed to render (§22.5 h): say so plainly, offer a retry, keep the raw detail behind a disclosure. */
export default function AccountError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6">
      <div role="alert" className="sheet p-8">
        <h1 className="font-display text-3xl font-semibold">This page couldn’t load.</h1>
        <p className="mt-2 text-ink-2">
          Nothing was sent and no money moved. It’s usually a network hiccup: try again in a moment.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => retry()}
            className="min-h-11 rounded-[3px] bg-seal-button px-5 font-medium text-on-seal focus-visible:outline-2 focus-visible:outline-indigo"
          >
            Try again
          </button>
          <a href="/app" className="min-h-11 content-center text-indigo underline">
            Back to your budgets
          </a>
        </div>
        <details className="mt-5 text-sm text-ink-2">
          <summary className="cursor-pointer">Details</summary>
          <p className="mt-2 break-words font-mono text-xs">{error.message || 'Unknown error'}</p>
          {error.digest && <p className="mt-1 font-mono text-xs">Reference: {error.digest}</p>}
        </details>
      </div>
    </div>
  )
}
