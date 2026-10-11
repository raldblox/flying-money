import { IconAgent, IconBowl, IconIssue, IconSeal } from '@/components/art/ink-icons'

type DemoId = 'counter' | 'agent' | 'slip'

/** The three demos: the home page's cards and the "keep exploring" strip on every demo page draw from this. */
export const DEMO_CARDS: Array<{
  id: DemoId
  href: string
  eyebrow: string
  title: string
  text: string
  Icon: typeof IconBowl
  steps: string[]
  cta: string
  accent: string
}> = [
  {
    id: 'counter',
    href: '/demo/counter',
    eyebrow: 'You are the shopper · 2 min',
    title: 'The offline counter',
    text: 'Buy tea, tip the staff, cut the till’s connection and keep paying.',
    Icon: IconBowl,
    steps: [
      'Claim a test budget',
      'Buy something and tip the staff',
      'Cut the till’s internet and pay again',
      'Collect, in one transaction',
    ],
    cta: 'Enter the shop',
    accent: 'border-seal',
  },
  {
    id: 'agent',
    href: '/demo',
    eyebrow: 'You supervise an agent · 1 min',
    title: 'Your agent, your approval',
    text: 'An AI agent wants to buy from a paid API. You decide what it may spend.',
    Icon: IconAgent,
    steps: [
      'Review the agent’s shopping list',
      'Approve it (we fund the budget)',
      'Watch it pay, call by call',
      'Read the briefing it brings back',
    ],
    cta: 'Meet the agent',
    accent: 'border-indigo',
  },
  {
    id: 'slip',
    href: '/demo/slip',
    eyebrow: 'See the payment itself · 1 min',
    title: 'The slip that pays',
    text: 'Get a 150-byte signed slip and spend it. It needs no internet to travel.',
    Icon: IconSeal,
    steps: [
      'The agent signs you a slip',
      'Spend it on the page, or carry it by QR, sound or link',
      'The seller checks it on the spot',
      'Receive your 飛錢 keepsake',
    ],
    cta: 'Get a slip',
    accent: 'border-ochre',
  },
]

/** Where to go next: the other demos, and the ways in for people who build. Shown on every demo page. */
export function MoreDemos({ current }: { current: DemoId }) {
  return (
    <section aria-labelledby="more-demos" className="mt-4">
      <h2 id="more-demos" className="smallcaps text-sm text-seal">
        Keep exploring
      </h2>
      <ul className="mt-3 grid gap-4 md:grid-cols-3">
        {DEMO_CARDS.filter((d) => d.id !== current).map(({ id, href, eyebrow, title, text, Icon }) => (
          <li key={id}>
            <a
              href={href}
              className="demo-panel group flex h-full gap-4 p-5 transition-colors hover:border-seal focus-visible:outline-2 focus-visible:outline-indigo"
            >
              <Icon className="size-12 shrink-0 text-ink" />
              <span>
                <span className="smallcaps block text-xs text-ink-2">{eyebrow}</span>
                <span className="mt-1 block font-display text-2xl font-semibold group-hover:text-seal">{title}</span>
                <span className="mt-1 block text-sm text-ink-2">{text}</span>
                <span className="mt-2 block text-sm font-medium text-indigo">Open →</span>
              </span>
            </a>
          </li>
        ))}
        <li>
          <a
            href="/docs/agents"
            className="demo-panel group flex h-full gap-4 border-dashed p-5 transition-colors hover:border-seal focus-visible:outline-2 focus-visible:outline-indigo"
          >
            <IconIssue className="size-12 shrink-0 text-ink" />
            <span>
              <span className="smallcaps block text-xs text-ink-2">Build with it</span>
              <span className="mt-1 block font-display text-2xl font-semibold group-hover:text-seal">
                Give your own agent a budget
              </span>
              <span className="mt-1 block text-sm text-ink-2">
                Connect Claude or Cursor in one message, or open a till.
              </span>
              <span className="mt-2 block text-sm font-medium text-indigo">Start building →</span>
            </span>
          </a>
        </li>
      </ul>
    </section>
  )
}
