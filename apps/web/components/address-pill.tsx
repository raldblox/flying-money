'use client'
import { useState } from 'react'
import { short } from '@/lib/fmt'

/** AddressPill (§11.3): a short address or hash, with an explorer link and a copy button. */
export function AddressPill({ value, href, label }: { value: string; href?: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line bg-paper py-0.5 pl-2 font-mono text-sm">
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-indigo underline decoration-line hover:decoration-indigo"
          title={value}
        >
          {short(value)}
        </a>
      ) : (
        <span title={value}>{short(value)}</span>
      )}
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value)
            setCopied(true)
            setTimeout(() => setCopied(false), 1200)
          } catch {}
        }}
        className="grid size-8 place-items-center rounded text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-indigo"
        aria-label={copied ? 'Copied' : `Copy ${label ?? 'value'}`}
      >
        <span aria-hidden className="text-xs">
          {copied ? '✓' : '⧉'}
        </span>
      </button>
    </span>
  )
}
