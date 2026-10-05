'use client'
import { type ChainKey, getChain } from '@flying-money/chains'
import type { Certificate } from '@flying-money/core'
import { useCallback, useEffect, useState } from 'react'
import { formatUnits } from 'viem'
import { useAccount } from 'wagmi'
import { AllowRequests } from '@/components/account/allow-requests'
import { AssistantSetup } from '@/components/account/assistant-setup'
import { FunderActions } from '@/components/app/funder-actions'
import { type IssuePreset, IssueWizard, type Place } from '@/components/app/issue-wizard'
import { WalletButton } from '@/components/app/wallet-button'
import { NetworkPicker } from '@/components/network-picker'
import { buttonClass } from '@/components/section'
import { StatusChip } from '@/components/status-chip'
import { Tally } from '@/components/tally'
import { loadCertificate } from '@/lib/chain'
import { addCertificateToHolder, badgeOf, getHolder, type Holder, listPlaces, type PlaceContact } from '@/lib/contacts'
import { relTime, short, usdc } from '@/lib/fmt'
import { toPickerNetworks } from '@/lib/networks'
import { deployedChains } from '@/lib/wagmi'

type Row = { chain: ChainKey; cert: Certificate | null; durationIdx: number }
const DAY = 86_400n

/** /app/people/[id] (§12.6): one holder's certificates, with Give, Top up, Extend, Renew. */
export function HolderControl({ id }: { id: string }) {
  const [holder, setHolder] = useState<Holder | null | undefined>(undefined)
  const [places, setPlaces] = useState<PlaceContact[]>([])
  const [rows, setRows] = useState<Row[] | null>(null)
  const [give, setGive] = useState<{ chain: ChainKey; preset: IssuePreset } | null>(null)
  const chains = deployedChains()
  const [chainKey, setChainKey] = useState<ChainKey>(
    (chains.find((c) => !c.mainnet) ?? chains[0])?.key ?? 'arbitrum-sepolia',
  )
  const { address } = useAccount()

  const load = useCallback(async () => {
    const h = await getHolder(id)
    setHolder(h)
    setPlaces(await listPlaces())
    if (!h) return
    setRows(
      await Promise.all(
        h.certificates.map(async (c) => ({
          chain: c.chain,
          durationIdx: c.durationIdx,
          cert: await loadCertificate(c.chain, c.id).catch(() => null),
        })),
      ),
    )
  }, [id])
  useEffect(() => {
    void load()
  }, [load])

  if (holder === undefined) return <p className="mt-8 text-ink-2">Loading…</p>
  if (holder === null)
    return (
      <p className="sheet mt-8 p-6">
        This person isn’t on this device. Contacts live only in the browser where you added them.{' '}
        <a className="text-indigo underline" href="/app/people">
          All people & agents
        </a>
      </p>
    )

  const now = BigInt(Math.floor(Date.now() / 1000))
  const open = (rows ?? []).filter((r) => r.cert && !r.cert.closed && r.cert.expiresAt >= now)
  const left = open.reduce((s, r) => s + (r.cert!.faceValue - r.cert!.redeemed), 0n)
  const collected = (rows ?? []).reduce((s, r) => s + (r.cert?.redeemed ?? 0n), 0n)
  const placeName = (payee: string) =>
    places.find((p) => p.payee.toLowerCase() === payee.toLowerCase())?.name ?? short(payee)

  const spenderPreset = (): IssuePreset =>
    holder.keyPolicy === 'one-key' && holder.address
      ? { spender: holder.address, spenderMode: 'paste' }
      : // people get the three-screen gift flow; agents keep the full form (§22.5 d)
        { spenderMode: 'generate', ...(holder.type !== 'agent' ? { forPerson: true } : {}) }

  const wizardPlaces = (k: ChainKey): Place[] =>
    places
      .filter((p) => p.chain === k)
      .map((p) => ({ name: p.name, address: p.payee, verified: p.verification !== 'unverified', badge: badgeOf(p) }))

  return (
    <div className="mt-6 grid gap-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="smallcaps text-sm text-ink-2">
            {holder.type} · {holder.keyPolicy === 'per-certificate' ? 'fresh key per budget' : 'one key'}
          </p>
          <h1 className="font-display text-5xl font-semibold tracking-tight">
            <span aria-hidden className="mr-2">
              {holder.emoji}
            </span>
            {holder.name}
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <WalletButton chain={getChain(give?.chain ?? chainKey)} />
          <button
            type="button"
            className={buttonClass('primary')}
            onClick={() => setGive({ chain: chainKey, preset: { ...spenderPreset(), holderName: holder.name } })}
          >
            Give a budget
          </button>
        </div>
      </div>

      <div className="sheet grid gap-2 p-5 sm:grid-cols-3">
        <p>
          <span className="smallcaps block text-xs text-ink-2">Left in total</span>
          <span className="font-display text-3xl font-semibold lining-nums">{usdc(left)}</span> USDC
        </p>
        <p>
          <span className="smallcaps block text-xs text-ink-2">Collected by shops so far</span>
          <span className="font-display text-3xl font-semibold lining-nums">{usdc(collected)}</span> USDC
        </p>
        <p>
          <span className="smallcaps block text-xs text-ink-2">Open budgets</span>
          <span className="font-display text-3xl font-semibold lining-nums">{open.length}</span>
        </p>
      </div>

      {holder.type === 'agent' && (
        <AssistantSetup
          holder={holder}
          certs={(rows ?? []).filter((r) => r.chain === chainKey && r.cert).map((r) => r.cert!)}
          chain={getChain(chainKey)}
          onFund={() => setGive({ chain: chainKey, preset: { ...spenderPreset(), holderName: holder.name } })}
        />
      )}
      {holder.type === 'agent' && (
        <AllowRequests holder={holder} chain={getChain(chainKey)} onChanged={() => void load()} />
      )}

      {give && (
        <section className="grid gap-4" aria-labelledby="give-t">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="give-t" className="font-display text-3xl font-semibold">
              Give {holder.name} a budget
            </h2>
            <div className="flex items-center gap-3">
              {chains.length > 1 && (
                <NetworkPicker
                  networks={toPickerNetworks(chains)}
                  value={give.chain}
                  onChange={(k) => setGive({ ...give, chain: k })}
                  hideLabel
                  compact
                />
              )}
              <button type="button" className="text-indigo underline" onClick={() => setGive(null)}>
                Close
              </button>
            </div>
          </div>
          {!address ? (
            <p className="sheet p-5">Connect your wallet (the funder) to issue.</p>
          ) : (
            <IssueWizard
              key={`${give.chain}-${JSON.stringify(give.preset)}`}
              chain={getChain(give.chain)}
              places={wizardPlaces(give.chain)}
              preset={give.preset}
              onIssued={async (info) => {
                await addCertificateToHolder(holder.id, {
                  chain: info.chain,
                  id: info.id,
                  place: info.payee,
                  faceValue: info.faceValue.toString(),
                  durationIdx: info.durationIdx,
                })
                await load()
              }}
            />
          )}
          {wizardPlaces(give.chain).length === 0 && (
            <p className="text-sm text-ink-2">
              Tip: save places first in{' '}
              <a className="text-indigo underline" href="/app/places">
                Places
              </a>{' '}
              (scan the shop’s code) so you don’t paste addresses by hand.
            </p>
          )}
        </section>
      )}

      <section aria-labelledby="certs-t">
        <h2 id="certs-t" className="font-display text-3xl font-semibold">
          Budgets
        </h2>
        {rows === null ? (
          <p className="mt-3 text-ink-2">Reading the blockchain…</p>
        ) : rows.length === 0 ? (
          <p className="mt-3 text-ink-2">None yet. Use “Give a budget”.</p>
        ) : (
          <ul className="mt-4 grid gap-4 md:grid-cols-2">
            {rows.map((r, k) => {
              const c = r.cert
              const saved = holder.certificates[k]!
              if (!c)
                return (
                  <li key={saved.id} className="sheet p-5 text-sm text-ink-2">
                    Couldn’t read {short(saved.id)} on {getChain(r.chain).chain.name}. Try again later.
                  </li>
                )
              const st = c.closed ? 'closed' : now > c.expiresAt ? 'expired' : 'open'
              const soon = st === 'open' && c.expiresAt - now < 3n * DAY
              const mine = address && c.funder.toLowerCase() === address.toLowerCase()
              return (
                <li key={c.id} className="sheet p-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-display text-2xl font-semibold">{placeName(c.payee)}</p>
                    <StatusChip kind={st}>{st[0]!.toUpperCase() + st.slice(1)}</StatusChip>
                  </div>
                  <p className="mt-1 text-sm text-ink-2 lining-nums">
                    {usdc(c.faceValue - c.redeemed)} of {usdc(c.faceValue)} left · {getChain(r.chain).chain.name} ·{' '}
                    {st === 'open' ? `expires ${relTime(c.expiresAt)}` : `ended ${relTime(c.expiresAt)}`}
                  </p>
                  <div className="mt-3">
                    <Tally used={c.redeemed} face={c.faceValue} />
                  </div>
                  {soon && (
                    <p className="mt-3 rounded border border-amber px-3 py-2 text-sm text-amber">
                      Ends {relTime(c.expiresAt)}. Renew?
                    </p>
                  )}
                  {mine ? (
                    <FunderActions chain={getChain(r.chain)} cert={c} onDone={() => void load()} />
                  ) : (
                    <p className="mt-3 text-xs text-ink-2">Connect the wallet that issued it to top up or extend.</p>
                  )}
                  <button
                    type="button"
                    className={`${buttonClass('secondary')} mt-3`}
                    onClick={() =>
                      setGive({
                        chain: r.chain,
                        preset: {
                          ...spenderPreset(),
                          placeAddress: c.payee,
                          // a plain number the amount field accepts (no thousands separators)
                          amount: formatUnits(c.faceValue, 6),
                          durationIdx: r.durationIdx,
                          // renewing gives it to the same person, not to the seller (§22.5 d)
                          holderName: holder.name,
                        },
                      })
                    }
                  >
                    Renew (same place, amount and length)
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </section>
    </div>
  )
}
