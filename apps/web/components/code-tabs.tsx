'use client'
import { useId, useState } from 'react'

export function CodeTabs({ tabs }: { tabs: Array<{ label: string; code: string }> }) {
  const [i, setI] = useState(0)
  const id = useId()
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-paper-2">
      <div role="tablist" aria-label="Code examples" className="flex border-b border-line">
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
          <pre className="overflow-x-auto p-5 font-mono text-sm leading-relaxed">
            <code>{t.code}</code>
          </pre>
        </div>
      ))}
    </div>
  )
}
