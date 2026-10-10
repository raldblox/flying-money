'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AccountButton } from './account-button'
import { MobileMenu } from './mobile-menu'
import { buttonClass } from './section'
import { ThemeSwitcher } from './theme-switcher'

const items = [
  { href: '/#demos', label: 'Try the demos' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/docs', label: 'Build with it' },
]

export function SiteNavigation() {
  const pathname = usePathname()
  return (
    <div className="flex items-center gap-2">
      <nav aria-label="Main" className="hidden items-center gap-3 lg:flex">
        <ul className="flex items-center gap-1">
          {items.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={pathname === href || pathname?.startsWith(`${href}/`) ? 'page' : undefined}
                className="inline-flex min-h-11 items-center whitespace-nowrap rounded px-3 text-sm text-ink-2 hover:text-ink hover:underline aria-[current=page]:text-seal aria-[current=page]:underline focus-visible:outline-2 focus-visible:outline-indigo"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
        <AccountButton />
        <Link href="/start" className={`${buttonClass()} whitespace-nowrap px-4 text-sm`}>
          Get started
        </Link>
      </nav>
      <ThemeSwitcher />
      <div className="flex shrink-0 items-center gap-2 lg:hidden">
        <span className="hidden min-[420px]:block">
          <AccountButton compact />
        </span>
        <MobileMenu
          items={[
            ...items,
            { href: '/demo/counter', label: 'Shop demo · be the visitor' },
            { href: '/demo', label: 'Agent demo · approve its plan' },
            { href: '/start', label: 'Get started' },
            { href: '/app', label: 'Open app · manage budgets' },
            { href: '/guarantees', label: 'Promises and limits' },
          ]}
        />
      </div>
    </div>
  )
}
