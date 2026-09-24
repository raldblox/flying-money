import { type ChainKey, chainKeys, getChain } from '@flying-money/chains'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AddressPill } from '@/components/address-pill'
import { ButtonLink, Sheet } from '@/components/section'
import { StatusChip } from '@/components/status-chip'
import { usdc } from '@/lib/fmt'

const PUBLIC = chainKeys.filter((k) => k !== 'anvil')

export const dynamicParams = false

export function generateStaticParams() {
  return PUBLIC.map((chain) => ({ chain }))
}

export async function generateMetadata({ params }: { params: Promise<{ chain: string }> }): Promise<Metadata> {
  const { chain } = await params
  if (!(PUBLIC as string[]).includes(chain)) return {}
  const c = getChain(chain as ChainKey)
  return {
    title: c.chain.name,
    description: `Contract, USDC, caps and status of Flying Money on ${c.chain.name}.`,
  }
}

/** /chains/[chain] (§21.2): one page per registry chain. Everything comes from @flying-money/chains. */
export default async function ChainPage({ params }: { params: Promise<{ chain: string }> }) {
  const { chain } = await params
  if (!(PUBLIC as string[]).includes(chain)) notFound()
  const c = getChain(chain as ChainKey)
  const q = `?chain=${c.key}`
  // keyless verification lands on Blockscout (D16); otherwise the explorer's code tab
  const sourceUrl = c.blockscoutApi
    ? `${c.blockscoutApi.replace(/\/api\/?$/, '')}/address/${c.flyingMoney}?tab=contract`
    : `${c.explorer}/address/${c.flyingMoney}#code`
  const caps =
    c.maxFaceValue === 0n
      ? 'None (test network)'
      : `${usdc(c.maxFaceValue, { min: 0 })} USDC per certificate · ${usdc(c.maxTotalOutstanding, { min: 0 })} USDC for the whole deployment (immutable)`

  return (
    <article className="mx-auto max-w-4xl px-4 py-14 sm:px-6">
      <p className="smallcaps text-sm text-seal">
        <a href="/chains" className="underline">
          Deployments
        </a>{' '}
        · {c.key} · chain id {c.chain.id}
      </p>
      <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight">Flying Money on {c.chain.name}</h1>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <StatusChip kind={c.flyingMoney ? 'open' : 'expired'}>
          {c.mainnet ? 'Mainnet · real USDC' : 'Testnet · test money'} ·{' '}
          {c.flyingMoney ? 'deployed' : 'not yet deployed'}
        </StatusChip>
        {c.mainnet && <span className="text-sm text-ink-2">Unaudited · capped</span>}
      </div>

      {c.notes.length > 0 && (
        <ul className="mt-6 list-disc space-y-1 pl-5 text-lg text-ink-2">
          {c.notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}

      <Sheet className="mt-8 p-6">
        <dl className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <dt className="text-sm text-ink-2">Contract</dt>
          <dd>
            {c.flyingMoney ? (
              <span className="flex flex-wrap items-center gap-3">
                <AddressPill value={c.flyingMoney} href={`${c.explorer}/address/${c.flyingMoney}`} label="contract" />
                <a className="text-sm text-indigo underline" href={sourceUrl} target="_blank" rel="noreferrer">
                  Verified source ↗
                </a>
              </span>
            ) : (
              <span className="text-ink-2">Not deployed yet.</span>
            )}
          </dd>
          <dt className="text-sm text-ink-2">USDC</dt>
          <dd>
            <AddressPill value={c.usdc} href={`${c.explorer}/address/${c.usdc}`} label="USDC" />
          </dd>
          <dt className="text-sm text-ink-2">Gas token</dt>
          <dd>{c.gasToken}</dd>
          <dt className="text-sm text-ink-2">Caps</dt>
          <dd>{caps}</dd>
          {c.faucets.length > 0 && (
            <>
              <dt className="text-sm text-ink-2">Test money</dt>
              <dd>
                {c.faucets.map((f) => (
                  <a key={f} href={f} target="_blank" rel="noreferrer" className="text-indigo underline">
                    {f.replace('https://', '')}
                  </a>
                ))}
              </dd>
            </>
          )}
          <dt className="text-sm text-ink-2">Explorer</dt>
          <dd>
            <a href={c.explorer} target="_blank" rel="noreferrer" className="text-indigo underline">
              {c.explorer.replace('https://', '')}
            </a>
          </dd>
        </dl>
      </Sheet>

      <h2 className="mt-12 font-display text-3xl font-semibold">Try it on {c.chain.name}</h2>
      {c.flyingMoney ? (
        <div className="mt-4 flex flex-wrap gap-3">
          <ButtonLink href={`/demo${q}`}>Watch an agent pay</ButtonLink>
          <ButtonLink href={`/app${q}`} variant="secondary">
            Give a certificate
          </ButtonLink>
          <ButtonLink href={`/shops${q}`} variant="secondary">
            Shops
          </ButtonLink>
        </div>
      ) : (
        <p className="mt-3 text-ink-2">
          Not deployed on {c.chain.name} yet. It is the same contract source and protocol as every other chain; see{' '}
          <a className="text-indigo underline" href="/chains">
            where it runs today
          </a>
          .
        </p>
      )}
    </article>
  )
}
