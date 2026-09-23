'use client'
import { useId, useState } from 'react'

export function CodeTabs({ tabs }: { tabs: Array<{ label: string; code: string }> }) {
  const [i, setI] = useState(0)
  const id = useId()
  return (
    <div className="sheet">
      <div role="tablist" aria-label="Code examples" className="flex gap-2 border-b-2 border-seal/60 px-4 pt-2">
        {tabs.map((t, k) => (
          <button
            key={t.label}
            id={`${id}-tab-${k}`}
            role="tab"
            type="button"
            aria-selected={i === k}
            aria-controls={`${id}-panel-${k}`}
            tabIndex={i === k ? 0 : -1}
            onClick={() => setI(k)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight') setI((i + 1) % tabs.length)
              if (e.key === 'ArrowLeft') setI((i - 1 + tabs.length) % tabs.length)
            }}
            className={`min-h-11 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-indigo ${i === k ? 'border-b-2 border-seal text-ink' : 'text-ink-2 hover:text-ink'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, k) => (
        <div key={t.label} id={`${id}-panel-${k}`} role="tabpanel" aria-labelledby={`${id}-tab-${k}`} hidden={i !== k}>
          <pre className="ledger overflow-x-auto px-6 py-4 font-mono text-sm leading-[2.25rem]">
            <code>{t.code}</code>
          </pre>
        </div>
      ))}
    </div>
  )
}
