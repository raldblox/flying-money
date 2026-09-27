import { type ChainKey, chainKeys, getChain } from '@flying-money/chains'
import type { Metadata } from 'next'
import '@/lib/e2e'
import { notFound } from 'next/navigation'
import { isAddress } from 'viem'
import { QrCode } from '@/components/qr'
import { ButtonLink } from '@/components/section'
import { short } from '@/lib/fmt'
import { SITE } from '@/lib/site'

// per request, so the strict CSP nonce (proxy.ts, audit F11) reaches every script
export const dynamic = 'force-dynamic'

export const metadata: Metadata = { title: 'Shop', robots: { index: false } }

/** The shop's public page (§12.5): print its QR at the counter so customers can open their wallet. */
export default async function ShopPublicPage({
  params,
  searchParams,
}: {
  params: Promise<{ chain: string; payee: string }>
  searchParams: Promise<{ name?: string }>
}) {
  const { chain, payee } = await params
  const { name: rawName } = await searchParams
  if (!(chainKeys as readonly string[]).includes(chain) || !isAddress(payee)) notFound()
  const c = getChain(chain as ChainKey)
  if (!c.flyingMoney) notFound()
  const name = (rawName ?? 'This shop').slice(0, 60)
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <article className="sheet p-8 text-center sm:p-12">
        <p className="smallcaps text-sm text-seal">Pay with a budget · {c.chain.name}</p>
        <h1 className="mt-2 font-display text-5xl font-semibold tracking-tight">{name}</h1>
        {rawName && (
          <p className="mt-1 text-xs text-amber">
            The name comes from the link and isn’t verified. The address below is.
          </p>
        )}
        <p className="mx-auto mt-4 max-w-md text-lg text-ink-2">
          Have a Flying Money budget for {name}? Open your wallet, scan the price code at the till, and show your code.
          No fees for you, no crypto wallet needed.
        </p>
        <div className="mx-auto mt-8 max-w-60">
          <QrCode
            value={`${SITE.url}/shop/${c.key}/${payee}?name=${encodeURIComponent(name)}`}
            label={`${name}: the shop’s code`}
          />
        </div>
        <p className="mt-2 text-sm text-ink-2">
          The shop’s code. Customers open it to reach their wallet; people who give budgets scan it in their account to
          add this shop as a verified place.
        </p>
        <p className="mt-6 text-xs text-ink-2">
          Payments go only to <span className="font-mono">{short(payee)}</span>. Only budgets made for this shop work
          here.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 print:hidden">
          <ButtonLink href="/wallet">Open my wallet</ButtonLink>
          <ButtonLink href={`/shop/${c.key}/${payee}/pos?name=${encodeURIComponent(name)}`} variant="secondary">
            I run this shop: open the till
          </ButtonLink>
        </div>
      </article>
    </div>
  )
}
