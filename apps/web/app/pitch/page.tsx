import { getChain } from '@flying-money/chains'
import type { Metadata } from 'next'
import { ButtonLink, Sheet } from '@/components/section'
import { short } from '@/lib/fmt'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Pitch',
  description: 'Flying Money for judges: the problem, the solution, what is built, and where to see it working.',
}

/** /pitch (§10.1, §16.1): a one-pager for judges. */
export default function PitchPage() {
  const arb = getChain('arbitrum-sepolia')
  return (
    <div className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="smallcaps text-sm text-seal">
        <span lang="zh-Hant">飛錢</span> · for judges
      </p>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight text-balance sm:text-6xl">
        Give your AI agent a <em className="text-seal">sealed certificate</em>, not your wallet.
      </h1>

      <div className="mt-10 grid gap-6">
        <Sheet className="p-7">
          <h2 className="font-display text-3xl font-semibold">The problem</h2>
          <p className="mt-2 text-lg text-ink-2">
            AI agents are becoming buyers: API calls, data and compute, thousands of times a day, for fractions of a
            cent. A card has no limit if the agent loops or is hijacked. Paying on the blockchain per request is too
            slow and too costly. And sellers can’t trust an anonymous agent’s promise to pay later.
          </p>
        </Sheet>
        <Sheet className="p-7">
          <h2 className="font-display text-3xl font-semibold">The solution</h2>
          <p className="mt-2 text-lg text-ink-2">
            The 804 CE idea of <em>feiqian</em>, flying money: deposit first, carry a certificate, settle later. A
            funder locks USDC for <strong className="text-ink">one seller</strong>, spendable by{' '}
            <strong className="text-ink">one agent key</strong>, until a date. The agent pays each request with a signed
            running total that the seller checks locally in milliseconds; the seller collects everything in one
            transaction. The same certificates work for people: a café tab, an allowance, a gift, paid by QR at the
            counter, even offline.
          </p>
        </Sheet>
        <Sheet className="p-7">
          <h2 className="font-display text-3xl font-semibold">Three claims, and no stronger ones</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-lg">
            <li>Every redeemable note is backed by funds reserved exclusively for its payee until expiry.</li>
            <li>The spender cannot authorize more than the certificate’s face value.</li>
            <li>Anyone can redeem a note, but its value only ever reaches the payee.</li>
          </ol>
          <p className="mt-3 text-sm text-ink-2">
            Unaudited; invariant-tested; testnets plus capped mainnets (100 USDC per certificate, 1,000 per deployment).{' '}
            <a className="text-indigo underline" href="/guarantees">
              What is and isn’t guaranteed →
            </a>
          </p>
        </Sheet>
        <Sheet className="p-7">
          <h2 className="font-display text-3xl font-semibold">What’s built</h2>
          <ul className="ledger mt-3 leading-[2.25rem]">
            <li>
              Contract with no owner, admin, pause or fee; 41 Foundry tests incl. invariants I1–I7 (256 runs × depth 50)
            </li>
            <li>
              SDK: client with a durable outbox (C1), seller middleware with replay safety and atomic reservations
              (S1–S4)
            </li>
            <li>Redeemer: batches notes; about 86k gas for one redeem, 328k for ten in one transaction</li>
            <li>Counting House (issue, redeem), live agent demo, shop till and customer wallet (works offline)</li>
            <li>Agent docs: /llms.txt, /llms-full.txt, Markdown twins, /.well-known/flying-money.json</li>
          </ul>
        </Sheet>
        <Sheet className="p-7">
          <h2 className="font-display text-3xl font-semibold">See it working</h2>
          <ul className="mt-3 grid gap-2">
            <li>
              <a className="text-indigo underline" href="/demo">
                Live demo
              </a>{' '}
              — an agent pays the Silk Road Oracle 20 times on Arbitrum Sepolia; real transactions.
            </li>
            <li>
              <a className="text-indigo underline" href="/shop">
                Shop mode
              </a>{' '}
              — the till and the customer wallet.
            </li>
            {arb.flyingMoney && (
              <li>
                Contract on {arb.chain.name}:{' '}
                <a
                  className="font-mono text-indigo underline"
                  href={`${arb.explorer}/address/${arb.flyingMoney}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {short(arb.flyingMoney)}
                </a>{' '}
                (verified) ·{' '}
                <a className="text-indigo underline" href="/chains">
                  all deployments
                </a>
              </li>
            )}
            <li>
              <a className="text-indigo underline" href={SITE.github}>
                Source on GitHub
              </a>{' '}
              (MIT) ·{' '}
              <a className="text-indigo underline" href="/docs">
                Docs
              </a>
            </li>
          </ul>
        </Sheet>
        <Sheet className="p-7">
          <h2 className="font-display text-3xl font-semibold">What we cut, and why</h2>
          <p className="mt-2 text-lg text-ink-2">
            We started out building offline cash between strangers. Our own review showed software alone can’t stop the
            same money being spent twice with two offline strangers, so we removed it, along with shared pools and
            endorsement chains. We only ship what the math guarantees.
          </p>
        </Sheet>
        <Sheet className="p-7">
          <h2 className="font-display text-3xl font-semibold">Team</h2>
          <p className="mt-2 text-lg text-ink-2">
            Built by{' '}
            <a className="text-indigo underline" href="https://github.com/raldblox">
              raldblox
            </a>
            . Contact through GitHub.
          </p>
        </Sheet>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/demo">Watch an agent pay →</ButtonLink>
        <ButtonLink href="/story" variant="secondary">
          Read the 804 CE story
        </ButtonLink>
      </div>
    </div>
  )
}
