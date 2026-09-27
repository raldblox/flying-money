'use client'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { IssueWizard, type Place } from '@/components/app/issue-wizard'
import { badgeOf, listPlaces, type PlaceContact } from '@/lib/contacts'
import { sellerFromLink } from '@/lib/shop-links'
import { useAccountCtx } from './context'

/** Giving a budget, as its own focused page (not the account's default view). */
export function Give() {
  const { chain, oraclePayee, refresh } = useAccountCtx()
  const params = useSearchParams()
  const forAgent = params?.get('for') === 'agent'
  const [saved, setSaved] = useState<PlaceContact[]>([])
  useEffect(() => {
    void listPlaces().then(setSaved)
  }, [])
  const known: Place[] = [
    ...(oraclePayee ? [{ name: 'Silk Road Oracle (demo)', address: oraclePayee, verified: true }] : []),
    ...saved
      .filter((p) => p.chain === chain.key && !(oraclePayee && p.payee.toLowerCase() === oraclePayee.toLowerCase()))
      .map((p) => ({ name: p.name, address: p.payee, verified: p.verification !== 'unverified', badge: badgeOf(p) })),
  ]
  // a shop's "get a budget for this shop" link (§22.10 e): anyone can make one, so it is unverified (§22.3, D37)
  const fromLink = params ? sellerFromLink(new URLSearchParams(params.toString())) : undefined
  const knownMatch = fromLink && known.find((p) => p.address.toLowerCase() === fromLink.address.toLowerCase())
  const places: Place[] =
    fromLink && !knownMatch ? [{ ...fromLink, name: `${fromLink.name} (from a link)` }, ...known] : known
  return (
    <div>
      <Link href="/app" className="text-sm text-indigo hover:underline">
        ← Home
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold">{forAgent ? 'Fund an agent' : 'Give a budget'}</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        {forAgent
          ? 'Set aside USDC for one service your agent uses. The agent pays from it per request and can never go past it.'
          : 'Set aside USDC for one place. The person pays with their phone, no crypto wallet needed. After the end date you can take back what they didn’t spend.'}
      </p>
      {fromLink && !knownMatch?.verified && (
        <div role="note" className="sheet mt-6 border-l-4 border-amber p-4">
          <p className="font-medium">This link names a shop: {fromLink.name}. We can’t check who shared it.</p>
          <p className="mt-1 text-sm text-ink-2">
            Before you give, check the address with the shop ({fromLink.address.slice(0, 6)}…
            {fromLink.address.slice(-4)}), or scan the QR code at its counter instead. Money for a wrong address can
            only be taken back after the end date.
          </p>
        </div>
      )}
      <div className="mt-6">
        <IssueWizard
          key={`${forAgent ? 'agent' : 'person'}-${fromLink?.address ?? ''}`}
          chain={chain}
          places={places}
          onIssued={refresh}
          preset={{
            ...(forAgent ? { spenderMode: 'paste' as const } : { spenderMode: 'generate' as const, forPerson: true }),
            ...(fromLink ? { placeAddress: fromLink.address } : {}),
          }}
        />
      </div>
    </div>
  )
}
