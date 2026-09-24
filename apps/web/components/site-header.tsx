import Link from 'next/link'
import { BrandMark } from '@/components/brand-mark'
import { MobileMenu } from '@/components/mobile-menu'
import { buttonClass } from '@/components/section'
import { SITE } from '@/lib/site'
import { deployedChains } from '@/lib/wagmi'

const nav = [
  { href: '/docs/agents', label: 'Agents' },
  { href: '/shops', label: 'Shops' },
  { href: '/docs', label: 'Docs' },
  { href: '/guarantees', label: 'Guarantees' },
  { href: '/app', label: 'Dashboard' },
]

const link =
  'smallcaps inline-block rounded px-3 py-2.5 text-[0.95rem] text-ink-2 underline-offset-8 hover:text-ink hover:underline hover:decoration-seal focus-visible:outline-2 focus-visible:outline-indigo'

export function SiteHeader() {
  // the banner states what is actually deployed, from the registry (no mainnet is live until one is deployed)
  const live = deployedChains()
  const mainnets = live.filter((c) => c.mainnet)
  const testnets = live.filter((c) => !c.mainnet)
  return (
    <header>
      <p className="border-b border-seal/30 bg-seal/10 px-4 py-1.5 text-center text-xs text-ink">
        <span className="smallcaps">{mainnets.length ? SITE.mainnetMode : SITE.testnetMode}</span>
        {live.length > 0 && (
          <>
            {' · '}
            <span className="hidden sm:inline">Live on </span>
            {(mainnets.length ? mainnets : testnets).map((c) => c.chain.name).join(', ')}
          </>
        )}
      </p>
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 md:py-5">
        <Link
          href="/"
          className="group flex min-w-0 items-center gap-3 rounded focus-visible:outline-2 focus-visible:outline-indigo"
        >
          <BrandMark size={48} className="shrink-0 transition-transform group-hover:-translate-y-0.5 md:hidden" />
          <BrandMark size={56} className="hidden shrink-0 transition-transform group-hover:-translate-y-0.5 md:block" />
          <span className="min-w-0 leading-none">
            <span className="block font-display text-[1.45rem] font-semibold tracking-tight md:text-[1.7rem]">
              Flying Money
            </span>
            <span className="smallcaps hidden text-xs text-ink-2 sm:block">money that flies, since 804</span>
          </span>
        </Link>

        {/* desktop */}
        <nav aria-label="Main" className="hidden items-center gap-2 md:flex">
          <ul className="flex gap-x-1">
            {nav.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className={link}>
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/demo" className={`${buttonClass('primary')} ml-2 min-h-10 px-4 text-sm`}>
            Try the demo
          </Link>
        </nav>

        {/* mobile: a fixed panel, so opening it never moves the header */}
        <div className="flex items-center gap-2 md:hidden">
          <Link href="/demo" className={`${buttonClass('primary')} min-h-10 px-3 text-sm`}>
            Demo
          </Link>
          <MobileMenu items={[...nav, { href: '/wallet', label: 'Wallet' }]} />
        </div>
      </div>
      <hr className="ink-rule mx-auto max-w-6xl" />
    </header>
  )
}
