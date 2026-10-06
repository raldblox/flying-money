'use client'
import { type ChainKey, chainKeys, getChain, getChainById } from '@flying-money/chains'
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
import { decodeNote, type Hex, type Offer } from '@flying-money/core'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { isHex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { CarryReceive, CarrySend } from '@/components/carry/carry'
import { FaceToFace } from '@/components/carry/face-to-face'
import { Keepsake } from '@/components/carry/keepsake'
import { GrantSummary } from '@/components/grant-summary'
import { NetworkPicker } from '@/components/network-picker'
import { useOnline } from '@/components/offline-ready'
import { buttonClass } from '@/components/section'
import { TestNote } from '@/components/test-note'
import { listenForCarried, PENDING_OFFER } from '@/lib/carry/channel'
import { decodeCarried, encodeNoteCompact } from '@/lib/carry/codec'
import { PROVERBS } from '@/lib/carry/proverbs'
import { decodeReceipt, receiptFor, type TillReceipt } from '@/lib/carry/receipt'
import { loadCertificate } from '@/lib/chain'
import { dayLabel, short, usdc, utcDate } from '@/lib/fmt'
import { toPickerNetworks } from '@/lib/networks'
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
import { backupNeedsPassphrase, openBackup, validBackupPassphrase } from '@/lib/wallet-backup'
import { listPayments, recordPayment, type WalletPayment } from '@/lib/wallet-history'

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
  // the PIN just set, kept in memory for this visit only, so a first budget isn't asked for it a third time (§22.5 e)
  const [sessionPin, setSessionPin] = useState<string | null>(null)
  const [onChain, setOnChain] = useState<Record<string, bigint>>({})
  const online = useOnline()

  const [payments, setPayments] = useState<WalletPayment[]>([])
  const refresh = useCallback(async () => {
    setEntries(await listEntries())
    setPayments(await listPayments())
  }, [])
  // a price code that arrived (scanned, heard, opened from a link or share): pick the budget, then review
  const payOffer = useCallback((offer: Offer, list: Entry[]) => {
    const fits = list.filter((e) => certificateMatches(toCounterCert(e), offer))
    if (fits.length === 1) setView({ k: 'review', offer, entry: fits[0]! })
    else setView({ k: 'choose', offer })
  }, [])

  useEffect(() => {
    let release: (() => void) | undefined
    let gone = false
    holdLock('fm-wallet')
      .then(async (r) => {
        if (gone) return r() // unmounted while waiting: let the next mount take the lock
        release = r
        const h = parseHandOver(window.location.hash)
        if (h) setView({ k: 'handover', h })
        const list = await listEntries()
        setEntries(list)
        setPayments(await listPayments())
        // a price code opened by /carry while this wallet wasn't open
        const pending = sessionStorage.getItem(PENDING_OFFER)
        if (pending && !h) {
          sessionStorage.removeItem(PENDING_OFFER)
          try {
            const c = decodeCarried(pending)
            if (c.kind === 'offer') payOffer(c.offer, list)
          } catch {
            // not a price code any more: ignore it
          }
        }
        setReady((await hasPin()) ? 'ok' : 'no-pin')
      })
      .catch(() => {
        if (!gone) setReady('busy')
      })
    return () => {
      gone = true
      release?.()
    }
  }, [payOffer])

  // a price code opened as a link or share in another tab lands here, if this wallet is open and ready
  useEffect(() => {
    if (ready !== 'ok') return
    return listenForCarried('wallet', (payload) => {
      try {
        const c = decodeCarried(payload)
        if (c.kind !== 'offer') return false
        payOffer(c.offer, entries)
        return true
      } catch {
        return false
      }
    })
  }, [ready, entries, payOffer])

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
        onDone={(pin) => {
          if (pin) setSessionPin(pin)
          setReady('ok')
        }}
        onRestored={async () => {
          await refresh()
          setReady('ok')
        }}
        intro={view.k === 'handover' ? 'Someone gave you a budget. First, choose a PIN for this wallet.' : undefined}
      />
    )

  const open = entries.find((e) => e.state?.pending)

  return (
    <div className="mt-4">
      {view.k === 'home' && (
        <Home
          entries={entries}
          history={payments}
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
          <ScanPrice onOffer={(offer) => payOffer(offer, entries)} />
        </Panel>
      )}
      {view.k === 'choose' && (
        <Panel title="Pay with which budget?" onBack={() => setView({ k: 'home' })}>
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
        <Panel title="Add a budget" onBack={() => setView({ k: 'home' })}>
          <AddCertificate
            onAdded={async () => {
              await refresh()
              setView({ k: 'home' })
            }}
          />
        </Panel>
      )}
      {view.k === 'handover' && (
        <Panel title="A budget for you" onBack={() => setView({ k: 'home' })}>
          <AcceptHandOver
            h={view.h}
            pin={sessionPin}
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
function SetPin({
  onDone,
  onRestored,
  intro,
}: {
  onDone: (pin?: string) => void
  onRestored: () => Promise<void>
  intro?: string | undefined
}) {
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [busy, setBusy] = useState(false)
  // opened directly, with nothing to add: say what this wallet is before asking for a PIN (§22.10 d)
  const [explained, setExplained] = useState(Boolean(intro))
  const ids = useId()
  const ok = validPin(a) && a === b
  if (!explained)
    return (
      <section className="sheet mt-6 grid gap-5 p-6" aria-labelledby="wallet-what">
        <h1 id="wallet-what" className="font-display text-4xl font-semibold">
          Your wallet for budgets
        </h1>
        <TestNote />
        <p className="text-lg text-ink-2">
          This is where you keep budgets someone gave you, like lunch money for the canteen. You pay at the counter by
          showing a QR code. You don’t need a crypto wallet, and you never pay a network fee.
        </p>
        <p className="text-ink-2">
          Got a budget link? Open that link on this phone and it lands here. Or set up now and add it later.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonClass('primary')} onClick={() => setExplained(true)}>
            Set up my wallet
          </button>
        </div>
        <div className="grid gap-1 border-t border-line pt-4 text-sm text-ink-2">
          <p>
            Want to give someone a budget instead?{' '}
            <a href="/app/give?for=person" className="text-indigo underline">
              Give a budget
            </a>
          </p>
          <p>
            Take payments at a shop?{' '}
            <a href="/shop" className="text-indigo underline">
              Open a till
            </a>
          </p>
        </div>
      </section>
    )
  return (
    <form
      className="sheet mt-6 grid gap-5 p-6"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!ok) return
        setBusy(true)
        await setPin(a)
        onDone(a)
      }}
    >
      <h1 className="font-display text-4xl font-semibold">Set up your wallet</h1>
      <TestNote />
      <p className="text-ink-2">
        {intro ?? 'Your budgets live on this phone.'} Choose a PIN of 6 to 12 digits. It locks the keys that sign your
        payments. Nobody can reset it for you, so write it down somewhere safe.
      </p>
      <PinInput id={`${ids}-a`} label="New PIN" value={a} onChange={setA} autoComplete="new-password" />
      <PinInput id={`${ids}-b`} label="Repeat the PIN" value={b} onChange={setB} autoComplete="new-password" />
      {b && a !== b && <p className="text-sm text-seal">The two PINs are different.</p>}
      <button type="submit" disabled={!ok || busy} className={buttonClass('primary')}>
        {busy ? 'Saving…' : 'Create my wallet'}
      </button>
      {/* a new phone restores first, keeping the backup's own PIN (§22.5 e) */}
      <details className="border-t border-line pt-4">
        <summary className="cursor-pointer font-medium">Moving from another phone? Restore a backup instead</summary>
        <div className="mt-3">
          <Backup onChanged={onRestored} empty restoreOnly />
        </div>
      </details>
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
  history,
  onChain,
  openPayment,
  onPay,
  onAdd,
  onShowOpen,
  onChanged,
}: {
  entries: Entry[]
  history: WalletPayment[]
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
        <h1 className="font-display text-5xl font-semibold tracking-tight">Your budgets</h1>
        <TestNote className="w-full" />
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
          <p className="font-display text-2xl font-semibold">No budgets on this device yet.</p>
          <p className="mt-2 text-ink-2">
            Open a link someone sent you, or tap Add to make a key for a budget you will fund yourself.
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
                  {usdc(left)} <span className="text-base font-normal text-ink-2">USDC left · on this phone</span>
                </p>
                <SpentBar face={c.faceValue} left={left} />
                <p className="mt-1 text-sm text-ink-2 lining-nums" suppressHydrationWarning>
                  of {usdc(c.faceValue)} · {expired ? 'ended' : `until ${dayLabel(c.expiresAt)}`}
                  {onChain[e.id] !== undefined && ` · collected by the shop so far: ${usdc(onChain[e.id]!)}`}
                </p>
                {/* the seller's name from the hand-over, not a raw address (§22.5 e) */}
                <GrantSummary
                  className="mt-2 text-sm"
                  amount={c.faceValue}
                  seller={e.label && e.label !== 'Budget' ? e.label : short(e.payee)}
                  user="this phone"
                  expiresAt={c.expiresAt}
                  test={!getChain(e.chain).mainnet}
                  perspective="holder"
                />
                <details className="mt-1 text-xs text-ink-2">
                  <summary className="cursor-pointer">Seller address</summary>
                  <span className="break-all font-mono">{e.payee}</span>
                </details>
                <Payments payments={history.filter((h) => h.certificateId.toLowerCase() === e.id.toLowerCase())} />
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
        haven’t installed (Safari after about a week of no use), and your budgets live only on this device.
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

function Backup({
  onChanged,
  empty,
  restoreOnly = false,
}: {
  onChanged: () => Promise<void>
  empty: boolean
  /** on the set-up screen: only restoring makes sense */
  restoreOnly?: boolean
}) {
  const [msg, setMsg] = useState<string | null>(null)
  const [pass, setPass] = useState('')
  const id = useId()
  const ok = validBackupPassphrase(pass)
  const Wrap = restoreOnly ? 'div' : 'details'
  return (
    <Wrap className={restoreOnly ? '' : 'sheet p-5'}>
      {!restoreOnly && <summary className="cursor-pointer font-medium">Backup and restore</summary>}
      <p className="mt-2 text-sm text-ink-2">
        A backup is a file locked with a passphrase you choose.{' '}
        <strong className="text-ink">Nobody can reset that passphrase</strong>: without it the file can’t be opened, by
        you or anyone else. If you lose both this phone and the backup, whoever funded a budget can still take back what
        wasn’t spent, after its end date.
      </p>
      <label htmlFor={`${id}-p`} className="mt-3 block text-sm font-medium">
        {restoreOnly ? 'The backup’s passphrase' : 'Backup passphrase (12+ characters)'}
      </label>
      <input
        id={`${id}-p`}
        type="password"
        autoComplete="new-password"
        value={pass}
        onChange={(e) => setPass(e.target.value)}
        className="mt-1 min-h-11 w-full rounded border border-line bg-paper px-3"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {!restoreOnly && (
          <button
            type="button"
            disabled={!ok}
            className={buttonClass('secondary')}
            onClick={async () => {
              const file = await exportBackup(pass)
              // prove the passphrase opens it before calling the backup done (§22.5 e)
              try {
                await openBackup(file, pass)
              } catch {
                setMsg('The backup could not be checked, so it was not saved. Try again.')
                return
              }
              const url = URL.createObjectURL(new Blob([file], { type: 'application/json' }))
              const a = document.createElement('a')
              a.href = url
              a.download = `flying-money-wallet-${new Date().toISOString().slice(0, 10)}.json`
              a.click()
              // let the download start before releasing the file
              setTimeout(() => URL.revokeObjectURL(url), 10_000)
              setMsg('Backup downloaded and checked: it opens with your passphrase. Keep both somewhere safe.')
            }}
          >
            Export backup
          </button>
        )}
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
                  const text = await f.text()
                  if (backupNeedsPassphrase(text) && !pass) return setMsg('Enter the backup passphrase first.')
                  await importBackup(text, pass)
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
    </Wrap>
  )
}

// ── Pay ──────────────────────────────────────────────────────────────────────
function ScanPrice({ onOffer }: { onOffer: (o: Offer) => void }) {
  const [err, setErr] = useState<string | null>(null)
  const [other, setOther] = useState(false)
  const read = (t: string, quiet: boolean) => {
    try {
      const c = decodeCarried(t)
      if (c.kind !== 'offer' || c.offer.accepts.length !== 1 || !c.offer.memoHint)
        throw new Error('not a till price code')
      onOffer(c.offer)
    } catch {
      // face to face, the camera may catch other codes on the way: only a deliberate scan reports them
      if (!quiet) setErr('That is not a Flying Money price code. Get the code the till shows for this order.')
    }
  }
  return (
    <>
      {!other ? (
        <>
          <p className="mb-3 text-sm text-ink-2">
            Hold your phone up to the till, screen to screen. It reads the price by itself.
          </p>
          <FaceToFace
            show={null}
            showLabel="Waiting for the price"
            waiting={<span>Waiting for the till’s price…</span>}
            onText={(t) => read(t, true)}
          />
        </>
      ) : (
        <CarryReceive prompt="Point the camera at the price code on the till." onText={(t) => read(t, false)} />
      )}
      <button type="button" className="mt-4 text-sm text-indigo underline" onClick={() => setOther((o) => !o)}>
        {other ? 'Back to face to face' : 'Other ways: back camera, sound, a file, paste'}
      </button>
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
        None of your budgets work at this shop. A budget is only valid at the one shop it was made for (
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
          ? 'Not enough left on this budget.'
          : e instanceof PendingUnresolvedError
            ? 'You have an open payment on this budget. Settle it first.'
            : e instanceof NoCertificateError
              ? 'This budget can’t pay here (another shop, or it expires too soon).'
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
      <p className="text-ink-2 lining-nums">{usdc(after)} USDC left after this</p>
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

/** The slip as the till takes it: compact without the memo (the till knows its own order), else as signed. */
function tillSlip(noteQr: string): string {
  try {
    return encodeNoteCompact(decodeNote(noteQr), { withMemo: false }) ?? noteQr
  } catch {
    return noteQr
  }
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
  // keep the screen awake while the till reads it (brightness can't be set from a web page)
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
  const note = decodeNote(noteQr)
  const [confirmNo, setConfirmNo] = useState(false)
  const [paid, setPaid] = useState<TillReceipt | null>(null)
  // Fixed light colours on purpose (both themes): the brightest screen gives the till's camera the best read.
  // a real modal: focus moves to it, Escape closes it (the payment stays open and can be shown again) (§22.5 h)
  const headRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    headRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // the till's receipt, read face to face, settles the question "did the shop accept it?" by itself
  const onReceipt = async (t: string) => {
    if (paid) return
    const r = decodeReceipt(t)
    if (!r || !receiptFor(r, note.memo, note.certificateId)) return
    await confirmCounterPayment(walletStore(), c)
    const k = r.keepsake
    const chain = getChainById(note.chainId)
    await recordPayment({
      id: note.memo,
      certificateId: note.certificateId,
      chain: (chain?.key ?? entry.chain) as ChainKey,
      at: Date.now(),
      price: r.price.toString(),
      status: r.status,
      ...(r.item ? { item: r.item } : {}),
      ...(k
        ? {
            keepsake: {
              serial: k.serial,
              name: k.name,
              issuedAt: k.issuedAt,
              paid: r.price.toString(),
              chainId: k.chainId,
              certificateId: note.certificateId,
              proverb: PROVERBS[k.proverb % PROVERBS.length]!,
            },
          }
        : {}),
    }).catch(() => {})
    navigator.vibrate?.(80)
    setPaid(r)
  }

  if (paid) {
    const chain = getChainById(note.chainId)
    const k = paid.keepsake
    return (
      <section
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-50 overflow-y-auto bg-[#fbf7ef] p-4 text-center text-[#1b1712]"
        aria-labelledby="paid-t"
      >
        <div className="mx-auto grid max-w-md gap-4">
          <p className="smallcaps mt-2 text-sm text-[#8a2a24]">
            {paid.status === 'GUARANTEED' ? 'Paid · checked by the till' : 'Paid · the till took it at its own risk'}
          </p>
          <h1 id="paid-t" className="font-display text-3xl font-semibold lining-nums">
            ✓ {usdc(price)} USDC · {entry.label}
          </h1>
          {paid.item && <p>{paid.item}</p>}
          {k && (
            <Keepsake
              data={{
                serial: k.serial,
                name: k.name,
                issuedAt: k.issuedAt,
                paid: paid.price.toString(),
                chainId: k.chainId,
                certificateId: note.certificateId,
                proverb: PROVERBS[k.proverb % PROVERBS.length]!,
              }}
              network={chain?.chain.name ?? `chain ${note.chainId}`}
              statusUrl={`${window.location.origin}/c/${chain?.key ?? note.chainId}/${note.certificateId}`}
            />
          )}
          <button type="button" className={buttonClass('primary')} onClick={() => void onClose()}>
            Done
          </button>
        </div>
      </section>
    )
  }

  return (
    <section
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 overflow-y-auto bg-[#fbf7ef] p-4 text-center text-[#1b1712]"
      aria-labelledby="note-t"
    >
      <div className="mx-auto max-w-md">
        <p className="smallcaps mt-2 text-sm text-[#8a2a24]">Hold this up to the till</p>
        <h1
          id="note-t"
          ref={headRef}
          tabIndex={-1}
          className="font-display text-3xl font-semibold lining-nums outline-none"
        >
          {usdc(price)} USDC · {entry.label}
        </h1>
        <div className="mt-4">
          <FaceToFace
            show={tillSlip(noteQr)}
            showLabel={`Your payment slip for ${usdc(price)} USDC`}
            onText={(t) => void onReceipt(t)}
          />
        </div>
        <TestNote className="mt-3 text-left" />
        <details className="mt-4 text-left text-sm">
          <summary className="cursor-pointer">Other ways, or answer by hand</summary>
          <div className="mt-3">
            <CarrySend
              payload={tillSlip(noteQr)}
              title={`Payment slip for ${usdc(price)} USDC`}
              carriers={['qr', 'sound', 'ultrasound', 'text', 'link', 'share']}
              fileName="flying-money-slip.txt"
            />
          </div>
          <p className="mt-4">Did the shop accept it?</p>
          <div className="mt-3 grid gap-3">
            <button
              type="button"
              className={buttonClass('primary')}
              onClick={async () => {
                await confirmCounterPayment(walletStore(), c)
                await recordPayment({
                  id: note.memo,
                  certificateId: note.certificateId,
                  chain: entry.chain,
                  at: Date.now(),
                  price: price.toString(),
                  status: 'CONFIRMED',
                }).catch(() => {})
                await onClose()
              }}
            >
              Yes, accepted
            </button>
            {!confirmNo ? (
              <button type="button" className="min-h-11 underline" onClick={() => setConfirmNo(true)}>
                No, it wasn’t accepted
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
          </div>
        </details>
        <button type="button" className="mt-4 min-h-11 text-sm underline" onClick={() => void onClose()}>
          Close (keep it open for later)
        </button>
      </div>
    </section>
  )
}

/** How much of the budget is spent, at a glance. */
function SpentBar({ face, left }: { face: bigint; left: bigint }) {
  const spent = face > left ? face - left : 0n
  const pct = face > 0n ? Number((spent * 1000n) / face) / 10 : 0
  return (
    <div className="mt-2">
      <div className="h-2 overflow-hidden rounded-full bg-paper-2" aria-hidden>
        <div className="h-full bg-seal" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-sm text-ink-2 lining-nums">
        {usdc(spent)} spent · {usdc(left)} left
      </p>
    </div>
  )
}

/** This budget's payments, newest first, with what was bought; a certificate opens full size. */
function Payments({ payments }: { payments: WalletPayment[] }) {
  const [open, setOpen] = useState<WalletPayment | null>(null)
  if (payments.length === 0) return <p className="mt-3 text-sm text-ink-2">No payments from this budget yet.</p>
  return (
    <details className="mt-3" open>
      <summary className="cursor-pointer text-sm font-medium">
        {payments.length} {payments.length === 1 ? 'payment' : 'payments'}
      </summary>
      <ul className="mt-2 grid gap-2">
        {payments.map((p) => (
          <li
            key={p.id}
            className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2 text-sm"
          >
            <span>
              <span className="font-medium">{p.item ?? 'Payment'}</span>
              <span className="block text-xs text-ink-2" suppressHydrationWarning>
                {new Date(p.at).toLocaleString()} ·{' '}
                {p.status === 'GUARANTEED'
                  ? 'checked by the till'
                  : p.status === 'UNVERIFIED'
                    ? 'taken at the till’s own risk'
                    : 'confirmed by you'}
              </span>
            </span>
            <span className="flex items-center gap-3">
              <span className="font-mono lining-nums">{usdc(BigInt(p.price))}</span>
              {p.keepsake && (
                <button type="button" className="text-indigo underline" onClick={() => setOpen(p)}>
                  Keepsake
                </button>
              )}
            </span>
          </li>
        ))}
      </ul>
      {open?.keepsake && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 overflow-y-auto bg-[#fbf7ef] p-4 text-[#1b1712]"
        >
          <div className="mx-auto grid max-w-md gap-4">
            <Keepsake
              data={open.keepsake}
              network={getChain(open.chain).chain.name}
              statusUrl={`${window.location.origin}/c/${open.chain}/${open.certificateId}`}
            />
            <button type="button" className={buttonClass('primary')} onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </details>
  )
}

// ── Add ──────────────────────────────────────────────────────────────────────
function AcceptHandOver({
  h,
  pin: known,
  onAdded,
}: {
  h: HandOver
  /** the PIN set a moment ago in this visit: not asked for again */
  pin?: string | null
  onAdded: () => Promise<void>
}) {
  const [pin, setPinValue] = useState(known ?? '')
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
        This link holds a budget’s spending key. Once it is added, it lives only on this phone, locked by your PIN.
        Anyone else with the same link could spend it too, so don’t share it further.
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
      {!known && <PinInput id={`${ids}-p`} label="Your PIN" value={pin} onChange={setPinValue} />}
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
              if (!h) throw new AddError('That link has no budget in it.')
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
          A budget you fund yourself
        </h2>
        <ol className="list-decimal space-y-1 pl-5 text-ink-2">
          <li>Make a spending key on this phone.</li>
          <li>
            In the{' '}
            <a className="text-indigo underline" href="/app/give">
              Flying Money app
            </a>
            , create a budget for the shop and paste this key’s address as “who can spend”.
          </li>
          <li>Paste the new budget’s id here.</li>
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
            <p className="text-sm font-medium">Spending key address (paste it when you create the budget):</p>
            <p className="break-all font-mono text-sm">{drafts[0]}</p>
            {chains.length > 1 && (
              <NetworkPicker networks={toPickerNetworks(chains)} value={chainKey} onChange={setChainKey} />
            )}
            <input
              aria-label="Budget id"
              value={certId}
              onChange={(e) => setCertId(e.target.value.trim())}
              placeholder="Budget id (0x…)"
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
              {busy ? 'Checking on the blockchain…' : 'Add the budget'}
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
