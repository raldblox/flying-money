'use client'
import { type ChainKey, chainKeys, getChain } from '@flying-money/chains'
import { useCallback, useEffect, useId, useState } from 'react'
import { type Hex, isAddress } from 'viem'
import { NetworkPicker } from '@/components/network-picker'
import { QrScanner } from '@/components/qr-scanner'
import { buttonClass } from '@/components/section'
import {
  badgeOf,
  deletePlace,
  listPlaces,
  type PlaceContact,
  placeFromScan,
  placesFromDomain,
  savePlace,
  verificationFor,
} from '@/lib/contacts'
import { short } from '@/lib/fmt'
import { toPickerNetworks } from '@/lib/networks'
import { e2eMode } from '@/lib/wagmi'

type Mode = 'scan' | 'domain' | 'paste'

/** /app/places (§12.6): where your holders can spend. Kept on this device only. */
export function Places() {
  const [places, setPlaces] = useState<PlaceContact[] | null>(null)
  const [mode, setMode] = useState<Mode>('scan')
  const refresh = useCallback(async () => setPlaces(await listPlaces()), [])
  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
      <section className="sheet p-6" aria-labelledby="add-place">
        <h2 id="add-place" className="font-display text-3xl font-semibold">
          Add a place
        </h2>
        <div role="tablist" aria-label="How to add" className="mt-4 flex flex-wrap gap-2">
          {(
            [
              ['scan', 'Scan at the shop'],
              ['domain', 'By domain'],
              ['paste', 'Paste an address'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={mode === k}
              onClick={() => setMode(k)}
              className={`min-h-10 rounded border px-3 text-sm font-medium ${mode === k ? 'border-seal text-seal' : 'border-ink/25'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="mt-5">
          {mode === 'scan' && <AddByScan onAdded={refresh} />}
          {mode === 'domain' && <AddByDomain onAdded={refresh} />}
          {mode === 'paste' && <AddByPaste onAdded={refresh} />}
        </div>
      </section>

      <section aria-labelledby="your-places">
        <h2 id="your-places" className="font-display text-3xl font-semibold">
          Your places
        </h2>
        {places === null ? (
          <p className="mt-3 text-ink-2">Loading…</p>
        ) : places.length === 0 ? (
          <p className="mt-3 text-ink-2">
            None yet. The safest way to add a shop is to scan its code at the counter: then you know the address is
            really theirs.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {places.map((p) => (
              <li key={p.id} className="sheet flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="font-display text-xl font-semibold">{p.name}</p>
                  <p className="font-mono text-xs text-ink-2">
                    {short(p.payee)} · {getChain(p.chain).chain.name}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-sm ${p.verification === 'unverified' ? 'text-amber' : 'text-ink-2'}`}>
                    {badgeOf(p)}
                  </span>
                  <button
                    type="button"
                    className="min-h-10 px-2 text-sm text-indigo underline"
                    onClick={async () => {
                      await deletePlace(p.id)
                      await refresh()
                    }}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-sm text-ink-2">
          Places live only on this device. Names never go on the blockchain or to any server.
        </p>
      </section>
    </div>
  )
}

function NameField({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        Name
      </label>
      <input
        id={id}
        value={value}
        maxLength={60}
        onChange={(e) => onChange(e.target.value)}
        placeholder="School Canteen"
        className="min-h-11 rounded border border-line bg-paper px-3"
      />
    </div>
  )
}

function AddByScan({ onAdded }: { onAdded: () => Promise<void> }) {
  const [found, setFound] = useState<
    (NonNullable<ReturnType<typeof placeFromScan>> & { via: 'camera' | 'paste' }) | null
  >(null)
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const id = useId()
  if (!found)
    return (
      <>
        <p className="mb-3 text-sm text-ink-2">
          Scan the shop’s price code at the till, or the QR on its shop page. That proves the address came from the
          shop.
        </p>
        <QrScanner
          prompt="Point the camera at the shop’s code."
          pasteLabel="Or paste the shop’s code or shop page link"
          onResult={(t, via) => {
            const f = placeFromScan(t, window.location.host)
            if (!f) return setErr('That isn’t a Flying Money shop code from this site.')
            setErr(null)
            setFound({ ...f, via })
            setName('')
          }}
        />
        {err && <p className="mt-2 text-sm text-seal">{err}</p>}
      </>
    )
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        await savePlace({
          name: name.trim() || 'Shop',
          chain: found.chain,
          payee: found.payee,
          verification: verificationFor(found.via),
        })
        setFound(null)
        await onAdded()
      }}
    >
      {found.via === 'camera' ? (
        <p className="text-sm">
          ✓ Scanned: <span className="font-mono">{short(found.payee)}</span> on {getChain(found.chain).chain.name}
        </p>
      ) : (
        <p className="text-sm text-amber">
          ⚠ Pasted, so not verified: <span className="font-mono">{short(found.payee)}</span> on{' '}
          {getChain(found.chain).chain.name}. Anyone can send a link. Check this address with the shop, or scan its code
          in person to verify it.
        </p>
      )}
      <NameField id={id} value={name} onChange={setName} />
      <button type="submit" className={buttonClass('primary')}>
        Save place
      </button>
    </form>
  )
}

function useChains() {
  const list = chainKeys.map(getChain).filter((c) => c.flyingMoney && (e2eMode ? c.key === 'anvil' : c.key !== 'anvil'))
  const [chain, setChain] = useState<ChainKey>((list.find((c) => !c.mainnet) ?? list[0])?.key ?? 'arbitrum-sepolia')
  return { list, chain, setChain }
}

function ChainSelect({
  id,
  list,
  value,
  onChange,
}: {
  id: string
  list: ReturnType<typeof useChains>['list']
  value: ChainKey
  onChange: (k: ChainKey) => void
}) {
  return (
    <div id={id}>
      {list.length > 1 ? <NetworkPicker networks={toPickerNetworks(list)} value={value} onChange={onChange} /> : null}
    </div>
  )
}

function AddByDomain({ onAdded }: { onAdded: () => Promise<void> }) {
  const { list, chain, setChain } = useChains()
  const [domain, setDomain] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ids = useId()
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setErr(null)
        try {
          const host = domain
            .trim()
            .replace(/^https?:\/\//, '')
            .replace(/\/.*$/, '')
          const payees = await placesFromDomain(host, chain)
          for (const payee of payees)
            await savePlace({ name: name.trim() || host, chain, payee, verification: 'domain', domain: host })
          setDomain('')
          await onAdded()
        } catch (x) {
          setErr(
            (x as Error).message.includes('fetch')
              ? 'Could not reach that domain (or it doesn’t allow browsers to read its file).'
              : (x as Error).message,
          )
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="text-sm text-ink-2">
        For online sellers: we read <span className="font-mono">https://domain/.well-known/flying-money.json</span> and
        save the address it lists, labelled with the domain.
      </p>
      <div className="grid gap-1">
        <label htmlFor={`${ids}-d`} className="text-sm font-medium">
          Domain
        </label>
        <input
          id={`${ids}-d`}
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="api.example.com"
          autoComplete="url"
          spellCheck={false}
          className="min-h-11 rounded border border-line bg-paper px-3 font-mono text-sm"
        />
      </div>
      <ChainSelect id={`${ids}-c`} list={list} value={chain} onChange={setChain} />
      <NameField id={`${ids}-n`} value={name} onChange={setName} />
      {err && <p className="text-sm text-seal">{err}</p>}
      <button type="submit" className={buttonClass('primary')} disabled={busy || !domain.trim()}>
        {busy ? 'Checking…' : 'Verify and save'}
      </button>
    </form>
  )
}

function AddByPaste({ onAdded }: { onAdded: () => Promise<void> }) {
  const { list, chain, setChain } = useChains()
  const [address, setAddress] = useState('')
  const [name, setName] = useState('')
  const ids = useId()
  const ok = isAddress(address) && name.trim().length > 0
  return (
    <form
      className="grid gap-3"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!ok) return
        await savePlace({ name: name.trim(), chain, payee: address as Hex, verification: 'unverified' })
        setAddress('')
        setName('')
        await onAdded()
      }}
    >
      <p className="text-sm text-amber">
        ⚠ A pasted address is unverified. You’ll be asked to confirm it twice before issuing.
      </p>
      <div className="grid gap-1">
        <label htmlFor={`${ids}-a`} className="text-sm font-medium">
          Address
        </label>
        <input
          id={`${ids}-a`}
          value={address}
          onChange={(e) => setAddress(e.target.value.trim())}
          placeholder="0x…"
          spellCheck={false}
          autoComplete="off"
          className="min-h-11 rounded border border-line bg-paper px-3 font-mono text-sm"
        />
      </div>
      <ChainSelect id={`${ids}-c`} list={list} value={chain} onChange={setChain} />
      <NameField id={`${ids}-n`} value={name} onChange={setName} />
      <button type="submit" className={buttonClass('primary')} disabled={!ok}>
        Save unverified place
      </button>
    </form>
  )
}
