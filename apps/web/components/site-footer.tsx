import Link from 'next/link'
import { SITE } from '@/lib/site'
import { BrandMark } from './brand-mark'

export function SiteFooter() {
  return (
    <footer className="mt-24">
      <hr className="ink-rule mx-auto max-w-6xl" />
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[auto_1fr_auto] md:items-start">
        <BrandMark size={64} className="shrink-0" />
        <div className="max-w-md text-sm leading-relaxed text-ink-2">
          <p className="font-display text-xl italic text-ink">Colophon</p>
          <p className="mt-2">
            Sealed spending certificates for AI agents, people and devices. Settled in Circle USDC. No token, no points,
            no airdrop. {SITE.footerStatus}. MIT licensed.
          </p>
        </div>
        <nav aria-label="Footer">
          <ul className="smallcaps grid gap-2 text-sm">
            <li>
              <a className="hover:text-seal" href={SITE.github}>
                Source on GitHub
              </a>
            </li>
            <li>
              <Link className="hover:text-seal" href="/chains">
                Deployments
              </Link>
            </li>
            <li>
              <Link className="hover:text-seal" href="/guarantees">
                Guarantees
              </Link>
            </li>
            {(
              [
                ['/docs', 'Docs'],
                ['/how-it-works', 'How it works'],
                ['/story', 'The 804 CE story'],
                ['/pitch', 'Pitch'],
                ['/llms.txt', 'llms.txt'],
              ] as const
            ).map(([href, label]) => (
              <li key={href}>
                <Link className="hover:text-seal" href={href}>
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  )
}
