import { getChain } from '@flying-money/chains'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ButtonLink, Sheet } from '@/components/section'
import { short } from '@/lib/fmt'
import { SITE } from '@/lib/site'

export const metadata: Metadata = {
  title: 'Pitch',
  description: 'Flying Money on one page: budgets for anything that spends on your behalf.',
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Sheet as="section" className="p-6 sm:p-7">
      <h2 className="font-display text-2xl font-semibold sm:text-3xl">{title}</h2>
      <div className="mt-3 text-lg leading-relaxed text-ink-2">{children}</div>
    </Sheet>
  )
}

function Dots({ items }: { items: string[] }) {
  return (
    <ul className="grid gap-2">
      {items.map((i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="mt-3 size-1.5 shrink-0 rounded-full bg-seal" />
          <span>{i}</span>
        </li>
      ))}
    </ul>
  )
}

/** /pitch (§10.1, §21.2): an event-neutral one-pager for investors and partners. */
export default function PitchPage() {
  const arb = getChain('arbitrum-sepolia')
  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-14">
      <p className="smallcaps text-sm text-seal">
        <span lang="zh-Hant">飛錢</span> · on one page
      </p>
      <h1 className="mt-2 font-display text-[2.4rem] font-semibold leading-[1.05] tracking-tight text-balance sm:text-6xl">
        Budgets for anything that <em className="text-seal">spends on your behalf.</em>
      </h1>

      <div className="mt-10 grid gap-5 sm:gap-6">
        <Block title="Problem">
          <p>
            AI agents are starting to buy things: API calls, data, compute, often for a fraction of a cent each. Today
            their owners have three bad choices: hand over a card with no real ceiling, pay on the blockchain per call
            (slower and costlier than the call itself), or ask sellers to trust an agent they’ve never met. The same gap
            exists for people: parents, employers and gift givers who want to hand over money for one place without
            handing over a card.
          </p>
        </Block>
        <Block title="Solution">
          <p>
            The owner sets aside a budget in USDC for one seller, one spender and one end date. The spender pays with
            signed slips carrying the running total. The seller checks each slip on its own machine in milliseconds and
            collects everything later in one transaction. The spender can’t authorize more than the budget, the money
            can only reach the named seller, and every valid slip is already backed by money set aside for that seller.
            Leftovers return to the owner.
          </p>
        </Block>
        <Block title="Why now">
          <Dots
            items={[
              'Agents can now use paid tools on their own (MCP, tool use), and HTTP 402 “Payment Required” is being revived as a way to charge them.',
              'Dollar stablecoins on low-fee networks make one settlement for many small payments practical.',
              'Owners need a hard spending limit that lives outside the prompt, because prompts can be hijacked.',
            ]}
          />
        </Block>
        <Block title="Market and wedge">
          <Dots
            items={[
              'Wedge: paid APIs and data services that want to charge agents per call without card fees or per-call transactions.',
              'Second front: closed-loop prepaid at places people pay often (canteens, cafés, events, suppliers), where offline acceptance for regulars matters.',
              'Same contract and SDK for both, so every seller that joins serves both kinds of spender.',
            ]}
          />
        </Block>
        <Block title="Business model (options, not yet validated)">
          <p className="mb-3">
            The contract charges no fee, has no owner and no token, and will stay that way. Revenue options sit around
            it:
          </p>
          <Dots
            items={[
              'A hosted collector that submits sellers’ payments and pays the network fee, for a monthly price.',
              'A hosted, durable seller backend for APIs that don’t want to run their own payment store.',
              'An owner dashboard with budget requests, receipts and team controls for companies running many agents.',
              'Card-to-USDC top-ups through a licensed on-ramp partner, on a referral basis.',
            ]}
          />
        </Block>
        <Block title="Traction to date (facts only)">
          <Dots
            items={[
              'Rebuilt from scratch starting 23 Sep 2026.',
              'Contract deployed and verified on Arbitrum Sepolia, with 41 Foundry tests including invariant tests at 256 runs × depth 50.',
              'Live test run: an agent made 20 paid calls, settled in 3 transactions, and the seller received exactly the 0.25 USDC it served. With its network cut, payments kept being accepted; a thief with the stolen key was refused three times.',
              'Working dashboard, shop till with offline acceptance, phone wallet, and an MCP server for Claude.',
              'Not yet audited. No mainnet deployment yet. No paying users yet.',
            ]}
          />
          {arb.flyingMoney && (
            <p className="mt-4 text-base">
              Contract on {arb.chain.name}:{' '}
              <a
                className="font-mono text-indigo underline"
                href={`${arb.explorer}/address/${arb.flyingMoney}`}
                target="_blank"
                rel="noreferrer"
              >
                {short(arb.flyingMoney)}
              </a>{' '}
              ·{' '}
              <a className="text-indigo underline" href={SITE.github}>
                source (MIT)
              </a>
            </p>
          )}
        </Block>
        <Block title="Ask">
          <p>
            Pilot partners (a paid API or data service, and one canteen or café) and funding for a security audit before
            a capped mainnet launch (100 USDC per budget, 1,000 USDC per deployment).
          </p>
        </Block>
        <Block title="Team">
          <p>
            Built by{' '}
            <a className="text-indigo underline" href="https://github.com/raldblox">
              raldblox
            </a>
            . Contact through GitHub.
          </p>
        </Block>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/demo">Watch an agent pay →</ButtonLink>
        <ButtonLink href="/guarantees" variant="secondary">
          What’s protected
        </ButtonLink>
      </div>
    </div>
  )
}
