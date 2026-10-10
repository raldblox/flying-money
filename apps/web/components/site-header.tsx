import Link from 'next/link'
import { BrandMark } from '@/components/brand-mark'
import { SiteNavigation } from '@/components/site-navigation'

export function SiteHeader() {
  return (
    <header className="relative z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link
          href="/"
          aria-label="Flying Money home"
          className="group flex min-w-0 shrink-0 items-center gap-2 rounded focus-visible:outline-2 focus-visible:outline-indigo sm:gap-3"
        >
          <BrandMark size={44} className="shrink-0 transition-transform group-hover:-translate-y-0.5" />
          <span className="leading-tight">
            <span className="block whitespace-nowrap font-display text-xl font-semibold tracking-tight sm:text-2xl">
              Flying Money
            </span>
            <span className="hidden text-xs text-ink-2 min-[400px]:block">Give a budget. Not your wallet.</span>
          </span>
        </Link>
        <SiteNavigation />
      </div>
      <hr className="ink-rule mx-auto max-w-6xl" />
    </header>
  )
}
