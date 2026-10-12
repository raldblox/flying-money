import type { ReactNode } from 'react'

/** A plain prose page for terms, privacy and security: one column, a "last updated" line, and a draft notice. */
export function LegalPage({
  title,
  updated,
  children,
  draft = true,
}: {
  title: string
  updated: string
  children: ReactNode
  draft?: boolean
}) {
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <p className="smallcaps text-sm text-seal">Flying Money</p>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight">{title}</h1>
      <p className="mt-2 text-sm text-ink-2">Last updated {updated}</p>
      {draft && (
        <p className="mt-6 rounded-md border border-amber/60 bg-amber/10 p-3 text-sm">
          Plain-language draft. It describes how the project works today and has not been reviewed by a lawyer.
        </p>
      )}
      <div className="mt-8 grid gap-6 text-lg leading-relaxed text-ink-2 [&_a]:text-indigo [&_a]:underline [&_h2]:font-display [&_h2]:text-3xl [&_h2]:font-semibold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc [&_strong]:text-ink">
        {children}
      </div>
    </article>
  )
}
