import type { Metadata } from 'next'
import { DocsNav } from '@/components/docs-nav'
import { allDocs } from '@/lib/docs'

export const metadata: Metadata = {
  title: 'Docs',
  description: 'Quickstarts for agents (buyers), APIs (sellers) and shops; protocol, contract and SDK reference.',
}

export default function DocsHome() {
  const docs = allDocs()
  const groups = [...new Set(docs.map((d) => d.group))]
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[13rem_1fr]">
      <DocsNav />
      <div>
        <p className="smallcaps text-sm text-seal">Docs</p>
        <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight">Read the ledger.</h1>
        <p className="mt-4 max-w-2xl text-lg text-ink-2">
          Every page also comes as plain Markdown for agents (add <code className="font-mono">.md</code>), and all of it
          is in one file at{' '}
          <a className="text-indigo underline" href="/llms-full.txt">
            /llms-full.txt
          </a>
          .
        </p>
        {groups.map((g) => (
          <section key={g} className="mt-10" aria-labelledby={`g-${g}`}>
            <h2 id={`g-${g}`} className="smallcaps text-sm text-ink-2">
              {g}
            </h2>
            <ul className="mt-3 grid gap-4 sm:grid-cols-2">
              {docs
                .filter((d) => d.group === g)
                .map((d) => (
                  <li key={d.slug}>
                    <a
                      href={`/docs/${d.slug}`}
                      className="sheet block h-full p-5 hover:-translate-y-0.5 transition-transform"
                    >
                      <span className="font-display text-2xl font-semibold">{d.title}</span>
                      <span className="mt-1 block text-ink-2">{d.description}</span>
                    </a>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
