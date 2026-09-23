import Link from 'next/link'
import { SITE } from '@/lib/site'

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-10 text-sm text-ink-2 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-5 gap-y-2">
            <li>
              <a className="hover:text-ink" href={SITE.github}>
                GitHub
              </a>
            </li>
            <li>
              <Link className="hover:text-ink" href="/chains">
                Deployments
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink" href="/guarantees">
                Guarantees
              </Link>
            </li>
            <li>
              <Link className="hover:text-ink" href="/hackathons/arbitrum">
                Hackathon: Arbitrum
              </Link>
            </li>
            <li>MIT</li>
          </ul>
        </nav>
        <p>{SITE.footerStatus}</p>
      </div>
    </footer>
  )
}
