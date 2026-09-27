import { allDocs } from '@/lib/docs'

export function DocsNav({ current }: { current?: string }) {
  const docs = allDocs()
  const groups = [...new Set(docs.map((d) => d.group))]
  return (
    <nav aria-label="Docs" className="text-sm lg:sticky lg:top-6 lg:self-start">
      <a href="/docs" className="font-display text-xl font-semibold">
        Docs
      </a>
      {groups.map((g) => (
        <div key={g} className="mt-4">
          <p className="smallcaps text-xs text-ink-2">{g}</p>
          <ul className="mt-1 grid gap-0.5">
            {docs
              .filter((d) => d.group === g)
              .map((d) => (
                <li key={d.slug}>
                  <a
                    href={`/docs/${d.slug}`}
                    aria-current={current === d.slug ? 'page' : undefined}
                    className={`block rounded px-2 py-1.5 hover:bg-paper-2 ${current === d.slug ? 'border-l-2 border-seal bg-paper-2 font-medium text-ink' : 'text-ink'}`}
                  >
                    {d.title}
                  </a>
                </li>
              ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}
