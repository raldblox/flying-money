'use client'
import { type ChainKey, chainKeys, getChain } from '@flying-money/chains'
import {
  abandonCounterPayment,
  type CounterState,
  certificateMatches,
  confirmCounterPayment,
  counterBalance,
  InsufficientBudgetError,
  NoCertificateError,
  PendingUnresolvedError,
  prepareCounterPayment,
} from '@flying-money/client/counter'
import { decodeOffer, type Hex, type Offer } from '@flying-money/core'
import { useCallback, useEffect, useId, useState } from 'react'
import { isHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { useOnline } from '@/components/offline-ready'
import { QrCode } from '@/components/qr'
import { QrScanner } from '@/components/qr-scanner'
import { buttonClass } from '@/components/section'
import { loadCertificate } from '@/lib/chain'
import { short, usdc, utcDate } from '@/lib/fmt'
import { unsealKey, validPin } from '@/lib/pin-vault'
import { holdLock } from '@/lib/till'
import {
  AddError,
  addCertificate,
  checkPin,
  draftKey,
  dropDraft,
  exportBackup,
  type HandOver,
  hasPin,
  importBackup,
  listDrafts,
  listEntries,
  newDraftKey,
  parseHandOver,
  setPin,
  toCounterCert,
  type WalletEntry,
  walletStore,
} from '@/lib/wallet'

type Entry = WalletEntry & { state: CounterState | null }
type View =
  | { k: 'home' }
  | { k: 'scan' }
  | { k: 'choose'; offer: Offer }
  | { k: 'review'; offer: Offer; entry: Entry }
  | { k: 'show'; entry: Entry; noteQr: string; price: bigint }
  | { k: 'add' }
  | { k: 'handover'; h: HandOver }

export function Wallet() {
  const [ready, setReady] = useState<'loading' | 'busy' | 'no-pin' | 'ok'>('loading')
  const [entries, setEntries] = useState<Entry[]>([])
  const [view, setView] = useState<View>({ k: 'home' })
  const [onChain, setOnChain] = useState<Record<string, bigint>>({})
  const online = useOnline()

  const refresh = useCallback(async () => setEntries(await listEntries()), [])

  useEffect(() => {
    let release: (() => void) | undefined
    let gone = false
    holdLock('fm-wallet')
      .then(async (r) => {
        if (gone) return r() // unmounted while waiting: let the next mount take the lock
        release = r
        const h = parseHandOver(window.location.hash)
        if (h) setView({ k: 'handover', h })
        await refresh()
        setReady((await hasPin()) ? 'ok' : 'no-pin')
      })
      .catch(() => {
        if (!gone) setReady('busy')
      })
    return () => {
      gone = true
      release?.()
    }
  }, [refresh])

  // When online, show what the shop has already collected on-chain (§12.5 balance labels).
  useEffect(() => {
    if (!online) return
    for (const e of entries)
      loadCertificate(e.chain, e.id)
        .then((c) => c && setOnChain((m) => ({ ...m, [e.id]: c.redeemed })))
        .catch(() => {})
  }, [online, entries])

  if (ready === 'loading') return <p className="mt-10 text-ink-2">Opening your wallet…</p>
  if (ready === 'busy')
    return (
      <p role="alert" className="sheet mt-8 p-8">
        Your wallet is already open in another tab. Use that one, so a payment is never shown twice.
      </p>
    )
  if (ready === 'no-pin')
    return (
      <SetPin
        onDone={() => setReady('ok')}
        intro={
          view.k === 'handover' ? 'Someone gave you a certificate. First, choose a PIN for this wallet.' : undefined
        }
      />
    )

  const open = entries.find((e) => e.state?.pending)

  return (
    <div className="mt-4">
      {view.k === 'home' && (
        <Home
          entries={entries}
          onChain={onChain}
          openPayment={open}
          onPay={() => setView({ k: 'scan' })}
          onAdd={() => setView({ k: 'add' })}
          onShowOpen={(e) =>
            setView({ k: 'show', entry: e, noteQr: e.state!.pending!.noteQr, price: e.state!.pending!.price })
          }
          onChanged={refresh}
        />
      )}
      {view.k === 'scan' && (
        <Panel title="Scan the price code at the till" onBack={() => setView({ k: 'home' })}>
          <ScanPrice
            onOffer={(offer) => {
              const fits = entries.filter((e) => certificateMatches(toCounterCert(e), offer))
              if (fits.length === 1) setView({ k: 'review', offer, entry: fits[0]! })
              else setView({ k: 'choose', offer })
            }}
          />
        </Panel>
      )}
      {view.k === 'choose' && (
        <Panel title="Pay with which certificate?" onBack={() => setView({ k: 'home' })}>
          <Choose
            offer={view.offer}
            entries={entries}
            onPick={(e) => setView({ k: 'review', offer: view.offer, entry: e })}
          />
        </Panel>
      )}
      {view.k === 'review' && (
        <Panel title="Review" onBack={() => setView({ k: 'home' })}>
          <Review
            offer={view.offer}
            entry={view.entry}
            onSealed={(noteQr) => setView({ k: 'show', entry: view.entry, noteQr, price: view.offer.price })}
          />
        </Panel>
      )}
      {view.k === 'show' && (
        <ShowNote
          entry={view.entry}
          noteQr={view.noteQr}
          price={view.price}
          onClose={async () => {
            await refresh()
            setView({ k: 'home' })
          }}
        />
      )}
      {view.k === 'add' && (
        <Panel title="Add a certificate" onBack={() => setView({ k: 'home' })}>
          <AddCertificate
            onAdded={async () => {
              await refresh()
              setView({ k: 'home' })
            }}
          />
        </Panel>
      )}
      {view.k === 'handover' && (
        <Panel title="A certificate for you" onBack={() => setView({ k: 'home' })}>
          <AcceptHandOver
            h={view.h}
            onAdded={async () => {
              history.replaceState(null, '', window.location.pathname) // the key leaves the address bar
              await refresh()
              setView({ k: 'home' })
            }}
          />
        </Panel>
      )}
    </div>
  )
}

function Panel({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <section className="sheet p-6" aria-labelledby="panel-t">
      <div className="flex items-center justify-between gap-3">
        <h1 id="panel-t" className="font-display text-3xl font-semibold">
          {title}
        </h1>
        <button type="button" onClick={onBack} className="min-h-10 px-2 text-indigo underline">
          Back
        </button>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  )
}

// ── PIN ──────────────────────────────────────────────────────────────────────
function SetPin({ onDone, intro }: { onDone: () => void; intro?: string | undefined }) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [busy, setBusy] = useState(false)
  const ids = useId()
  const ok = validPin(a) && a === b
  return (
    <form
      className="sheet mt-6 grid gap-5 p-6"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!ok) return
        setBusy(true)
        await setPin(a)
        onDone()
      }}
    >
      <h1 className="font-display text-4xl font-semibold">Set up your wallet</h1>
      <p className="text-ink-2">
        {intro ?? 'Your certificates live on this phone.'} Choose a PIN of 6 to 12 digits. It locks the keys that sign
        your payments. Nobody can reset it for you, so write it down somewhere safe.
      </p>
      <PinInput id={`${ids}-a`} label="New PIN" value={a} onChange={setA} autoComplete="new-password" />
      <PinInput id={`${ids}-b`} label="Repeat the PIN" value={b} onChange={setB} autoComplete="new-password" />
      {b && a !== b && <p className="text-sm text-seal">The two PINs are different.</p>}
      <button type="submit" disabled={!ok || busy} className={buttonClass('primary')}>
        {busy ? 'Saving…' : 'Create my wallet'}
      </button>
    </form>
  )
}

function PinInput({
  id,
  label,
  value,
  onChange,
  autoComplete = 'current-password',
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
  autoComplete?: string
}) {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type="password"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete={autoComplete}
        maxLength={12}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ''))}
        className="min-h-12 rounded border border-line bg-paper px-3 font-mono text-2xl tracking-[0.4em]"
      />
    </div>
  )
}

// ── Home ─────────────────────────────────────────────────────────────────────
function Home({
  entries,
  onChain,
  openPayment,
  onPay,
  onAdd,
  onShowOpen,
  onChanged,
}: {
  entries: Entry[]
  onChain: Record<string, bigint>
  openPayment: Entry | undefined
  onPay: () => void
  onAdd: () => void
  onShowOpen: (e: Entry) => void
  onChanged: () => Promise<void>
}) {
  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-5xl font-semibold tracking-tight">Your certificates</h1>
        <div className="flex gap-3">
          <button type="button" className={buttonClass('primary')} onClick={onPay} disabled={entries.length === 0}>
            Pay
          </button>
          <button type="button" className={buttonClass('secondary')} onClick={onAdd}>
            Add
          </button>
        </div>
      </div>

      {openPayment && (
        <div role="alert" className="sheet border-l-4 border-seal p-5">
          <p className="font-medium">You have an open payment at {openPayment.label}.</p>
          <p className="mt-1 text-sm text-ink-2">
            Show the same code again until the shop accepts it. A new payment can’t start until this one is settled.
          </p>
          <button type="button" className={`${buttonClass('primary')} mt-3`} onClick={() => onShowOpen(openPayment)}>
            Show the code again
          </button>
        </div>
      )}

      {entries.length === 0 ? (
        <div className="sheet p-8 text-center">
          <p className="font-display text-2xl font-semibold">No certificates on this device yet.</p>
          <p className="mt-2 text-ink-2">
            Open a link someone sent you, or tap Add to make a key for a certificate you will fund yourself.
          </p>
        </div>
      ) : (
        <ul className="grid gap-4">
          {entries.map((e) => {
            const c = toCounterCert(e)
            const left = counterBalance(c, e.state)
            const expired = BigInt(Math.floor(Date.now() / 1000)) > c.expiresAt
            return (
              <li key={e.id} className="sheet p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-display text-2xl font-semibold">{e.label}</h2>
                  <span className="smallcaps text-xs text-ink-2">{getChain(e.chain).chain.name}</span>
                </div>
                <p className="mt-2 font-display text-4xl font-semibold lining-nums">
                  {usdc(left)} <span className="text-base font-normal text-ink-2">USDC left on this device</span>
                </p>
                <p className="mt-1 text-sm text-ink-2 lining-nums">
                  of {usdc(c.faceValue)} · {expired ? 'expired' : `valid until ${utcDate(c.expiresAt)}`}
                  {onChain[e.id] !== undefined && ` · collected by the shop so far: ${usdc(onChain[e.id]!)}`}
                </p>
                <p className="mt-1 font-mono text-xs text-ink-2">Only valid at {short(e.payee)}</p>
              </li>
            )
          })}
        </ul>
      )}

      <Backup onChanged={onChanged} empty={entries.length === 0} />
      <InstallHint />
    </div>
  )
}

function InstallHint() {
  const [prompt, setPrompt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null)
  useEffect(() => {
    const on = (e: Event) => {
      e.preventDefault()
      setPrompt(e as Event & { prompt: () => Promise<void> })
    }
    window.addEventListener('beforeinstallprompt', on)
    return () => window.removeEventListener('beforeinstallprompt', on)
  }, [])
  return (
    <aside className="text-sm text-ink-2">
      <p>
        <strong className="text-ink">Add this wallet to your home screen.</strong> Browsers can clear data for sites you
        haven’t installed (Safari after about a week of no use), and your certificates live only on this device.
      </p>
      {prompt ? (
        <button type="button" className={`${buttonClass('secondary')} mt-2`} onClick={() => void prompt.prompt()}>
          Install the wallet
        </button>
      ) : (
        <p className="mt-1">On iPhone: tap Share, then “Add to Home Screen”.</p>
      )}
    </aside>
  )
}

function Backup({ onChanged, empty }: { onChanged: () => Promise<void>; empty: boolean }) {
  const [msg, setMsg] = useState<string | null>(null)
  const id = useId()
  return (
    <details className="sheet p-5">
      <summary className="cursor-pointer font-medium">Backup and restore</summary>
      <p className="mt-2 text-sm text-ink-2">
        The backup file holds your certificates with their keys still locked by your PIN. Keep it somewhere private.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={buttonClass('secondary')}
          onClick={async () => {
            const url = URL.createObjectURL(new Blob([await exportBackup()], { type: 'application/json' }))
            const a = document.createElement('a')
            a.href = url
            a.download = `flying-money-wallet-${new Date().toISOString().slice(0, 10)}.json`
            a.click()
            URL.revokeObjectURL(url)
            setMsg('Backup downloaded.')
          }}
        >
          Export backup
        </button>
        {empty && (
          <>
            <label htmlFor={id} className={`${buttonClass('secondary')} cursor-pointer`}>
              Restore a backup
            </label>
            <input
              id={id}
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                if (!f) return
                try {
                  await importBackup(await f.text())
                  setMsg('Restored. Use the PIN you had when you made the backup.')
                  await onChanged()
                } catch (err) {
                  setMsg((err as Error).message)
                }
              }}
            />
          </>
        )}
      </div>
      {msg && (
        <p role="status" className="mt-2 text-sm">
          {msg}
        </p>
      )}
    </details>
  )
}

// ── Pay ──────────────────────────────────────────────────────────────────────
function ScanPrice({ onOffer }: { onOffer: (o: Offer) => void }) {
  const [err, setErr] = useState<string | null>(null)
  return (
    <>
      <QrScanner
        prompt="Point the camera at the price code on the till."
        pasteLabel="Or paste the price code"
        onResult={(t) => {
          try {
            const o = decodeOffer(t.trim())
            if (o.accepts.length !== 1 || !o.memoHint) throw new Error('not a till price code')
            onOffer(o)
          } catch {
            setErr('That is not a Flying Money price code. Scan the code the till shows for this order.')
          }
        }}
      />
      {err && (
        <p role="alert" className="mt-2 text-sm text-seal">
          {err}
        </p>
      )}
    </>
  )
}

function Choose({ offer, entries, onPick }: { offer: Offer; entries: Entry[]; onPick: (e: Entry) => void }) {
  const fits = entries.filter((e) => certificateMatches(toCounterCert(e), offer))
  if (fits.length === 0)
    return (
      <p>
        None of your certificates work at this shop. A certificate is only valid at the one shop it was made for (
        <span className="font-mono">{short(offer.accepts[0]!.payee)}</span>).
      </p>
    )
  return (
    <ul className="grid gap-3">
      {fits.map((e) => (
        <li key={e.id}>
          <button
            type="button"
            onClick={() => onPick(e)}
            className="flex min-h-14 w-full items-center justify-between rounded-md border border-line bg-paper px-4 text-left hover:border-seal"
          >
            <span className="font-medium">{e.label}</span>
            <span className="lining-nums">{usdc(counterBalance(toCounterCert(e), e.state))} USDC left</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

function Review({ offer, entry, onSealed }: { offer: Offer; entry: Entry; onSealed: (qr: string) => void }) {
  const [pin, setPinValue] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const id = useId()
  const c = toCounterCert(entry)
  const left = counterBalance(c, entry.state)
  const after = left >= offer.price ? left - offer.price : 0n

  async function approve() {
    setBusy(true)
    setErr(null)
    try {
      if (!(await checkPin(pin))) throw new AddError('Wrong PIN.')
      const key = await unsealKey(pin, entry.vault)
      const r = await prepareCounterPayment({
        store: walletStore(),
        spender: privateKeyToAccount(key),
        certificate: c,
        offer,
      })
      onSealed(r.noteQr)
    } catch (e) {
      setErr(
        e instanceof InsufficientBudgetError
          ? 'Not enough left on this certificate.'
          : e instanceof PendingUnresolvedError
            ? 'You have an open payment on this certificate. Settle it first.'
            : e instanceof NoCertificateError
              ? 'This certificate can’t pay here (another shop, or it expires too soon).'
              : (e as Error).message,
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form
      className="grid gap-5"
      onSubmit={(e) => {
        e.preventDefault()
        void approve()
      }}
    >
      <p className="font-display text-3xl font-semibold lining-nums">
        Pay {usdc(offer.price)} USDC to {entry.label}
      </p>
      <p className="text-ink-2 lining-nums">Remaining after: {usdc(after)} USDC</p>
      <PinInput id={id} label="Your PIN" value={pin} onChange={setPinValue} />
      {err && (
        <p role="alert" className="text-sm text-seal">
          {err}
        </p>
      )}
      <button type="submit" disabled={!validPin(pin) || busy || left < offer.price} className={buttonClass('primary')}>
        {busy ? 'Sealing…' : 'Approve and show my code'}
      </button>
    </form>
  )
}

function ShowNote({
  entry,
  noteQr,
  price,
  onClose,
}: {
  entry: Entry
  noteQr: string
  price: bigint
  onClose: () => Promise<void>
}) {
  // keep the screen awake while the cashier scans (brightness can't be set from a web page)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined
    ;(navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<typeof lock> } }).wakeLock
      ?.request('screen')
      .then((l) => {
        lock = l
      })
      .catch(() => {})
    return () => void lock?.release().catch(() => {})
  }, [])
  const c = toCounterCert(entry)
  const [confirmNo, setConfirmNo] = useState(false)
  // Fixed light colours on purpose (both themes): the brightest screen gives cashiers' scanners the best read.
  return (
    <section
      className="fixed inset-0 z-50 overflow-y-auto bg-[#fbf7ef] p-4 text-center text-[#1b1712]"
      aria-labelledby="note-t"
    >
      <div className="mx-auto max-w-md">
        <p className="smallcaps mt-2 text-sm text-[#8a2a24]">Show this to the cashier</p>
        <h1 id="note-t" className="font-display text-3xl font-semibold lining-nums">
          {usdc(price)} USDC · {entry.label}
        </h1>
        <div className="mx-auto mt-4 max-w-[min(90vw,26rem)]">
          <QrCode value={noteQr} label={`Your sealed payment code for ${usdc(price)} USDC`} />
        </div>
        <details className="mt-2 text-left text-sm">
          <summary className="cursor-pointer">Copy the code instead</summary>
          <textarea
            readOnly
            value={noteQr}
            aria-label="Sealed payment code"
            onFocus={(e) => e.currentTarget.select()}
            className="mt-2 h-24 w-full rounded border border-[#cdbfa6] p-2 font-mono text-xs"
          />
        </details>
        <p className="mt-4 text-sm">Did the till say “Accepted”?</p>
        <div className="mt-3 grid gap-3">
          <button
            type="button"
            className={buttonClass('primary')}
            onClick={async () => {
              await confirmCounterPayment(walletStore(), c)
              await onClose()
            }}
          >
            Yes, the shop accepted it
          </button>
          {!confirmNo ? (
            <button type="button" className="min-h-11 underline" onClick={() => setConfirmNo(true)}>
              No, the shop didn’t accept it
            </button>
          ) : (
            <div className="rounded border border-[#cdbfa6] p-3 text-sm">
              <p>
                Only choose this if the till showed “Rejected” or you are not buying. If the shop did accept it, your
                next payment will be refused until you show this code again.
              </p>
              <button
                type="button"
                className={`${buttonClass('secondary')} mt-3`}
                onClick={async () => {
                  await abandonCounterPayment(walletStore(), c)
                  await onClose()
                }}
              >
                Cancel this payment
              </button>
            </div>
          )}
          <button type="button" className="min-h-11 text-sm underline" onClick={() => void onClose()}>
            Close (keep it open for later)
          </button>
        </div>
      </div>
    </section>
  )
}

// ── Add ──────────────────────────────────────────────────────────────────────
function AcceptHandOver({ h, onAdded }: { h: HandOver; onAdded: () => Promise<void> }) {
  const [pin, setPinValue] = useState('')
  const [label, setLabel] = useState(h.name ?? '')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ids = useId()
  return (
    <form
      className="grid gap-5"
      onSubmit={async (e) => {
        e.preventDefault()
        setBusy(true)
        setErr(null)
        try {
          if (!(await checkPin(pin))) throw new AddError('Wrong PIN.')
          await addCertificate({ chain: h.chain, id: h.id, key: h.key, pin, label })
          await onAdded()
        } catch (x) {
          setErr((x as Error).message)
        } finally {
          setBusy(false)
        }
      }}
    >
      <p className="text-ink-2">
        This link holds a certificate’s spending key. Once it is added, it lives only on this device, locked by your
        PIN. Anyone else with the same link could spend it too, so don’t share it further.
      </p>
      <div className="grid gap-1">
        <label htmlFor={`${ids}-l`} className="text-sm font-medium">
          Name it (e.g. the shop)
        </label>
        <input
          id={`${ids}-l`}
          value={label}
          maxLength={40}
          onChange={(e) => setLabel(e.target.value)}
          className="min-h-11 rounded border border-line bg-paper px-3"
        />
      </div>
      <PinInput id={`${ids}-p`} label="Your PIN" value={pin} onChange={setPinValue} />
      {err && (
        <p role="alert" className="text-sm text-seal">
          {err}
        </p>
      )}
      <button type="submit" disabled={!validPin(pin) || busy} className={buttonClass('primary')}>
        {busy ? 'Checking on the blockchain…' : 'Add to my wallet'}
      </button>
    </form>
  )
}

function AddCertificate({ onAdded }: { onAdded: () => Promise<void> }) {
  const [drafts, setDrafts] = useState<Hex[]>([])
  const [pin, setPinValue] = useState('')
  const [link, setLink] = useState('')
  const [certId, setCertId] = useState('')
  const [chainKey, setChainKey] = useState<ChainKey>(
    (chainKeys.map(getChain).find((c) => c.flyingMoney && !c.mainnet && c.key !== 'anvil')?.key ??
      'arbitrum-sepolia') as ChainKey,
  )
  const [label, setLabel] = useState('')
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const ids = useId()
  useEffect(() => {
    void listDrafts().then(setDrafts)
  }, [])

  async function run(f: () => Promise<void>) {
    setBusy(true)
    setErr(null)
    try {
      if (!(await checkPin(pin))) throw new AddError('Wrong PIN.')
      await f()
    } catch (x) {
      setErr((x as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const chains = chainKeys.map(getChain).filter((c) => c.flyingMoney && c.key !== 'anvil')

  return (
    <div className="grid gap-8">
      <PinInput id={`${ids}-pin`} label="Your PIN (needed for either option)" value={pin} onChange={setPinValue} />

      <section className="grid gap-3" aria-labelledby={`${ids}-a`}>
        <h2 id={`${ids}-a`} className="font-display text-2xl font-semibold">
          From a link someone sent you
        </h2>
        <input
          aria-label="Paste the link"
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://…/wallet#add=…"
          autoComplete="off"
          spellCheck={false}
          className="min-h-11 rounded border border-line bg-paper px-3 font-mono text-sm"
        />
        <button
          type="button"
          className={buttonClass('primary')}
          disabled={!validPin(pin) || busy || !parseHandOver(link.slice(link.indexOf('#')))}
          onClick={() =>
            void run(async () => {
              const h = parseHandOver(link.slice(link.indexOf('#')))
              if (!h) throw new AddError('That link has no certificate in it.')
              await addCertificate({ chain: h.chain, id: h.id, key: h.key, pin, label: h.name })
              await onAdded()
            })
          }
        >
          Add from link
        </button>
      </section>

      <section className="grid gap-3" aria-labelledby={`${ids}-b`}>
        <h2 id={`${ids}-b`} className="font-display text-2xl font-semibold">
          A certificate you fund yourself
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-ink-2">
          <li>Make a spending key on this phone.</li>
          <li>
            In the{' '}
            <a className="text-indigo underline" href="/app">
              Counting House
            </a>
            , issue a certificate for the shop and paste this key’s address as “who can spend”.
          </li>
          <li>Paste the new certificate’s id here.</li>
        </ol>
        <button
          type="button"
          className={buttonClass('secondary')}
          disabled={!validPin(pin) || busy}
          onClick={() =>
            void run(async () => {
              await newDraftKey(pin)
              setDrafts(await listDrafts())
            })
          }
        >
          Make a spending key
        </button>
        {drafts.length > 0 && (
          <div className="grid gap-3 rounded border border-line p-4">
            <p className="text-sm font-medium">Spending key address (paste it in the Counting House):</p>
            <p className="break-all font-mono text-sm">{drafts[0]}</p>
            <div className="grid gap-1">
              <label htmlFor={`${ids}-c`} className="text-sm font-medium">
                Network
              </label>
              <select
                id={`${ids}-c`}
                value={chainKey}
                onChange={(e) => setChainKey(e.target.value as ChainKey)}
                className="min-h-11 rounded border border-line bg-paper px-3"
              >
                {chains.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.chain.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              aria-label="Certificate id"
              value={certId}
              onChange={(e) => setCertId(e.target.value.trim())}
              placeholder="Certificate id (0x…)"
              spellCheck={false}
              autoComplete="off"
              className="min-h-11 rounded border border-line bg-paper px-3 font-mono text-sm"
            />
            <input
              aria-label="Name it"
              value={label}
              maxLength={40}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Name it (e.g. the shop)"
              className="min-h-11 rounded border border-line bg-paper px-3"
            />
            <button
              type="button"
              className={buttonClass('primary')}
              disabled={!validPin(pin) || busy || !(isHex(certId) && certId.length === 66)}
              onClick={() =>
                void run(async () => {
                  const address = drafts[0]!
                  const key = await draftKey(address, pin)
                  if (!key) throw new AddError('That key is no longer on this device.')
                  await addCertificate({ chain: chainKey, id: certId as Hex, key, pin, label })
                  await dropDraft(address)
                  await onAdded()
                })
              }
            >
              {busy ? 'Checking on the blockchain…' : 'Add the certificate'}
            </button>
          </div>
        )}
      </section>

      {err && (
        <p role="alert" className="text-sm text-seal">
          {err}
        </p>
      )}
    </div>
  )
}
