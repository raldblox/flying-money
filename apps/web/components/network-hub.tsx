import { allChains, type ChainConfig } from '@flying-money/chains'
import Link from 'next/link'
import { AddressPill } from '@/components/address-pill'
import { ButtonLink } from '@/components/section'
import { StatusChip } from '@/components/status-chip'
import { usdc } from '@/lib/fmt'

export type NetworkType = 'all' | 'mainnet' | 'testnet'

const byBrand = (a: ChainConfig, b: ChainConfig) =>
  a.brand.localeCompare(b.brand) || a.chain.name.localeCompare(b.chain.name)

const TABS: Array<{ type: NetworkType; href: string; label: string }> = [
  { type: 'all', href: '/networks', label: 'All networks' },
  { type: 'mainnet', href: '/mainnet', label: 'Mainnets · real money' },
  { type: 'testnet', href: '/testnet', label: 'Test networks · practice money' },
]

function Card({ c }: { c: ChainConfig }) {
  const q = `?chain=${c.key}`
  const caps =
    c.maxFaceValue === 0n
      ? 'No caps on a test network'
      : `${usdc(c.maxFaceValue, { min: 0 })} USDC per budget · ${usdc(c.maxTotalOutstanding, { min: 0 })} in total`
  return (
    <article
      id={c.key}
      className="sheet grid content-between gap-4 p-5"
      aria-labelledby={`${c.key}-t`}
      data-network={c.key}
    >
      <div className="grid gap-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 id={`${c.key}-t`} className="font-display text-2xl font-semibold">
            {c.chain.name}
          </h3>
          <StatusChip kind={c.mainnet ? 'sealed' : 'open'}>
            {c.mainnet ? 'Mainnet · real USDC' : 'Testnet · test money'}
          </StatusChip>
        </div>
        <p className="text-sm text-ink-2">
          {c.mainnet ? 'Capped, not audited: ' : ''}
          {caps}
          {c.gasToken === 'USDC' ? ' · fees paid in USDC' : ` · fees in ${c.gasToken}`}
        </p>
        {c.flyingMoney ? (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-ink-2">Contract</span>
            <AddressPill value={c.flyingMoney} href={`${c.explorer}/address/${c.flyingMoney}`} label="contract" />
          </p>
        ) : (
          <p className="text-sm text-ink-2">Not deployed yet.</p>
        )}
      </div>
      {c.flyingMoney && (
        <div className="flex flex-wrap gap-2">
          {c.mainnet ? (
            <>
              <ButtonLink href={`/app/give${q}`}>Give a budget · real USDC</ButtonLink>
              <ButtonLink href={`/app${q}`} variant="secondary">
                Open the app
              </ButtonLink>
            </>
          ) : (
            <>
              <ButtonLink href={`/demo/counter${q}`}>Try the shop demo</ButtonLink>
              <ButtonLink href={`/demo${q}`} variant="secondary">
                Watch an agent pay
              </ButtonLink>
              <ButtonLink href={`/app${q}`} variant="secondary">
                Open the app
              </ButtonLink>
            </>
          )}
          <Link
            href={`/chains/${c.key}`}
            className="inline-flex min-h-11 items-center px-2 text-sm text-indigo underline focus-visible:outline-2 focus-visible:outline-indigo"
          >
            Details
          </Link>
        </div>
      )}
    </article>
  )
}

/**
 * The network chooser (every chain in one place, mainnet and test networks kept apart): what judges and builders land
 * on to find their chain. Everything comes from @flying-money/chains; `/mainnet` and `/testnet` are the same page,
 * filtered, so each can be shared as its own link.
 */
export function NetworkHub({ type }: { type: NetworkType }) {
  const chains = allChains()
    .filter((c) => c.key !== 'anvil')
    .sort(byBrand)
  const mainnets = chains.filter((c) => c.mainnet)
  const testnets = chains.filter((c) => !c.mainnet)
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <p className="smallcaps text-sm text-seal">Networks</p>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight">Find your network.</h1>
      <p className="mt-4 max-w-3xl text-lg text-ink-2">
        Flying Money is one contract source and one protocol on every network below. Pick yours: real-money networks are
        capped and kept apart from test networks, and every card links to the deployed contract.
      </p>

      <nav aria-label="Network type" className="mt-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.type}
            href={t.href}
            aria-current={t.type === type ? 'page' : undefined}
            className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm text-ink-2 hover:text-ink aria-[current=page]:border-seal aria-[current=page]:bg-seal/10 aria-[current=page]:text-ink focus-visible:outline-2 focus-visible:outline-indigo"
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <section className="mt-6" aria-labelledby="find-t">
        <h2 id="find-t" className="sr-only">
          Jump to a network
        </h2>
        <ul className="flex flex-wrap gap-2">
          {(type === 'mainnet' ? mainnets : type === 'testnet' ? testnets : chains).map((c) => (
            <li key={c.key}>
              <a
                href={`#${c.key}`}
                className="inline-flex min-h-9 items-center rounded border border-line px-3 text-sm hover:bg-paper-2 focus-visible:outline-2 focus-visible:outline-indigo"
              >
                {c.chain.name}
                <span className="ml-2 text-xs text-ink-2">{c.mainnet ? 'mainnet' : 'testnet'}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      {type !== 'testnet' && (
        <section className="mt-10" aria-labelledby="mainnet-t">
          <h2 id="mainnet-t" className="font-display text-3xl font-semibold">
            Mainnets · real money
          </h2>
          <p className="mt-2 max-w-3xl text-ink-2">
            Real USDC. The contract is not audited, so every budget and the whole deployment are capped, and the caps
            are fixed in the contract. Start small.
          </p>
          <div className="mt-5 grid gap-5 md:grid-cols-2">
            {mainnets.map((c) => (
              <Card key={c.key} c={c} />
            ))}
          </div>
        </section>
      )}

      {type !== 'mainnet' && (
        <section className="mt-12" aria-labelledby="testnet-t">
          <h2 id="testnet-t" className="font-display text-3xl font-semibold">
            Test networks · practice money
          </h2>
          <p className="mt-2 max-w-3xl text-ink-2">
            Test money with no value. The demos run here with sponsored funds, so you can try everything without a
            wallet.
          </p>
          <div className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {testnets.map((c) => (
              <Card key={c.key} c={c} />
            ))}
          </div>
        </section>
      )}

      <p className="mt-10 text-sm text-ink-2">
        Building something on one of these networks, or want yours added? Adding a network is one registry entry, and
        the contract source is the same.{' '}
        <Link href="/chains" className="text-indigo underline">
          Compare every deployment
        </Link>{' '}
        ·{' '}
        <a href="https://github.com/raldblox/flying-money" className="text-indigo underline">
          Source
        </a>
      </p>
    </div>
  )
}
