import Link from 'next/link'
import { SITE } from '@/lib/site'

const nav = [
  { href: '/demo', label: 'Live demo' },
  { href: '/guarantees', label: 'Guarantees' },
  { href: '/chains', label: 'Deployments' },
  { href: '/hackathons/arbitrum', label: 'Arbitrum' },
]

export function SiteHeader() {
  return (
    <header className="border-b border-line">
      <p className="bg-paper-2 px-4 py-1.5 text-center text-xs text-ink-2">{SITE.testnetMode} · Arbitrum Sepolia</p>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="flex items-baseline gap-2 rounded focus-visible:outline-2 focus-visible:outline-indigo"
        >
          <span className="font-han text-2xl text-seal" lang="zh-Hant">
            {SITE.han}
          </span>
          <span className="font-display text-2xl font-semibold tracking-tight">Flying Money</span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap gap-x-1 text-sm">
            {nav.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className="inline-block rounded px-3 py-2.5 text-ink-2 hover:text-ink focus-visible:outline-2 focus-visible:outline-indigo"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}
