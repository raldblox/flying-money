import Link from 'next/link'
import { BrandMark } from '@/components/brand-mark'
import { SITE } from '@/lib/site'

const nav = [
  { href: '/demo', label: 'Live demo' },
  { href: '/app', label: 'Counting House' },
  { href: '/shop', label: 'Shops' },
  { href: '/wallet', label: 'Wallet' },
  { href: '/guarantees', label: 'Guarantees' },
  { href: '/chains', label: 'Deployments' },
  { href: '/hackathons/arbitrum', label: 'Arbitrum' },
]

export function SiteHeader() {
  return (
    <header>
      <p className="border-b border-seal/30 bg-seal/10 px-4 py-1.5 text-center text-xs text-ink">
        <span className="smallcaps">{SITE.testnetMode}</span> · Arbitrum Sepolia
      </p>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-8 gap-y-3 px-4 py-5 sm:px-6">
        <Link
          href="/"
          className="group flex items-center gap-3 rounded focus-visible:outline-2 focus-visible:outline-indigo"
        >
          <BrandMark size={56} className="shrink-0 transition-transform group-hover:-translate-y-0.5" />
          <span className="leading-none">
            <span className="block font-display text-[1.7rem] font-semibold tracking-tight">Flying Money</span>
            <span className="smallcaps block text-xs text-ink-2">money that flies, since 804</span>
          </span>
        </Link>
        <nav aria-label="Main">
          <ul className="flex flex-wrap gap-x-1">
            {nav.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  className="smallcaps inline-block rounded px-3 py-2.5 text-[0.95rem] text-ink-2 underline-offset-8 hover:text-ink hover:underline hover:decoration-seal focus-visible:outline-2 focus-visible:outline-indigo"
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
      <hr className="ink-rule mx-auto max-w-6xl" />
    </header>
  )
}
