import Link from 'next/link'
import { SITE } from '@/lib/site'
import { BrandMark } from './brand-mark'

const groups = [
  {
    title: 'Experience it',
    links: [
      ['/demo/counter', 'Shop demo'],
      ['/demo', 'Agent demo'],
      ['/demo/slip', 'Carry a payment slip'],
      ['/start', 'Get started'],
    ],
  },
  {
    title: 'Use it',
    links: [
      ['/app', 'Manage budgets'],
      ['/wallet', 'Spend a budget'],
      ['/shop', 'Open a shop till'],
      ['/shops', 'Find a shop'],
    ],
  },
  {
    title: 'Understand it',
    links: [
      ['/how-it-works', 'How it works'],
      ['/guarantees', 'Promises and limits'],
      ['/chains', 'Networks and deployments'],
      ['/story', 'The Flying Money story'],
    ],
  },
  {
    title: 'Build with it',
    links: [
      ['/docs/agents', 'Agent quickstart'],
      ['/docs/server', 'Seller quickstart'],
      ['/docs', 'Documentation'],
      ['/llms.txt', 'Docs for your AI'],
      [SITE.github, 'Source on GitHub'],
      ['/pitch', 'Project overview'],
    ],
  },
] as const

export function SiteFooter() {
  return (
    <footer className="mt-12">
      <hr className="ink-rule mx-auto max-w-6xl" />
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex items-center gap-4">
          <BrandMark size={48} className="shrink-0" />
          <div>
            <p className="font-display text-2xl font-semibold">Give a budget. Not your wallet.</p>
            <p className="mt-1 text-sm text-ink-2">
              One seller. One spending key. An amount and an end date you choose.
            </p>
          </div>
        </div>
        <nav
          aria-label="Footer"
          className="mt-8 grid grid-cols-2 gap-x-6 gap-y-8 border-t border-line pt-8 md:grid-cols-4"
        >
          {groups.map(({ title, links }) => (
            <div key={title}>
              <h2 className="smallcaps text-sm text-seal">{title}</h2>
              <ul className="mt-3 grid gap-1">
                {links.map(([href, label]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="inline-flex min-h-10 items-center rounded py-2 text-sm text-ink-2 underline-offset-4 hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-indigo"
                    >
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
        <div className="mt-8 grid gap-3 border-t border-line pt-6 text-xs leading-relaxed text-ink-2 sm:grid-cols-2 sm:gap-10">
          <p>
            Demos use sponsored test funds. You bring no money or wallet. For your own budgets, funding and collection
            require network fees; there is no Flying Money token or platform fee.
          </p>
          <p>
            Open source (MIT) · Not yet audited. Network availability and deployment limits vary.{' '}
            <Link className="underline underline-offset-4" href="/chains">
              Check deployments
            </Link>{' '}
            before funding a budget.
          </p>
        </div>
      </div>
    </footer>
  )
}
