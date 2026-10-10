export function Journey({
  steps,
  current,
  completed,
  optional = [],
}: {
  steps: string[]
  current: number
  completed?: number[]
  optional?: number[]
}) {
  return (
    <ol className="demo-journey grid grid-cols-2 gap-2 sm:flex sm:flex-wrap" aria-label="Your demo journey">
      {steps.map((step, i) => (
        <li
          key={step}
          aria-current={i === current ? 'step' : undefined}
          className={`flex items-center gap-2 border-b-2 px-3 py-3 text-sm sm:flex-1 ${i === current ? 'border-seal font-semibold' : (completed ? completed.includes(i) : i < current) ? 'border-celadon' : 'border-line text-ink-2'}`}
        >
          <span className="font-mono text-xs">{String(i + 1).padStart(2, '0')}</span>
          {step}
          {optional.includes(i) && <span className="text-xs text-ink-2">Optional</span>}
          {(completed ? completed.includes(i) : i < current) && <span className="sr-only">completed</span>}
        </li>
      ))}
    </ol>
  )
}
