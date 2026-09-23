import Link from 'next/link'
import { SITE } from '@/lib/site'

const nav = [
  { href: '/demo', label: 'Live demo' },
  { href: '/app', label: 'Counting House' },
  { href: '/guarantees', label: 'Guarantees' },
  { href: '/chains', label: 'Deployments' },
  { href: '/hackathons/arbitrum', label: 'Arbitrum' },
]

/** The maker's mark: 飛錢 stacked in a vermilion seal (Chinese text: pending native-reader review, H8). */
export function SealLogo({ size = 44 }: { size?: number }) {
  return (
    <span
      aria-hidden
      lang="zh-Hant"
      className="inline-grid shrink-0 place-items-center rounded-[5px] bg-seal font-han leading-none text-paper shadow-[inset_0_0_0_2px_var(--paper),inset_0_0_0_3px_var(--seal)] -rotate-3"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      <span className="flex flex-col items-center gap-[1px]">
        <span>飛</span>
        <span>錢</span>
      </span>
    </span>
  )
}

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
          <SealLogo />
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
