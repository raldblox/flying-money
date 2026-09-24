/** Counting House sub-navigation: certificates, people & agents, places (§12.6). */
export function ContactsNav({ current }: { current: 'app' | 'people' | 'places' }) {
  const items = [
    ['app', '/app', 'Give & collect'],
    ['people', '/app/people', 'Holders'],
    ['places', '/app/places', 'Places'],
  ] as const
  return (
    <nav aria-label="Counting House" className="flex flex-wrap items-center gap-1">
      <span className="smallcaps mr-2 text-sm text-seal">Dashboard</span>
      {items.map(([k, href, label]) => (
        <a
          key={k}
          href={href}
          aria-current={current === k ? 'page' : undefined}
          className={`min-h-10 rounded-[3px] px-3 py-2 text-sm font-medium ${current === k ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'}`}
        >
          {label}
        </a>
      ))}
    </nav>
  )
}
