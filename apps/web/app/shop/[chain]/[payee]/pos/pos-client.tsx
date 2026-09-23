'use client'
import { flyingMoneyAbi } from '@flying-money/abi'
import { type ChainKey, getChain } from '@flying-money/chains'
import type { CounterResult, PendingRedemption, RejectReason, UnverifiedRecord } from '@flying-money/server/browser'
import { useCallback, useEffect, useId, useState } from 'react'
import { type Hex, parseUnits } from 'viem'
import { useAccount, useChainId, usePublicClient, useWalletClient } from 'wagmi'
import { TxStatus, useTx } from '@/components/app/tx'
import { WalletButton } from '@/components/app/wallet-button'
import { useOnline } from '@/components/offline-ready'
import { QrCode } from '@/components/qr'
import { QrScanner } from '@/components/qr-scanner'
import { Seal } from '@/components/seal'
import { buttonClass } from '@/components/section'
import { short, usdc, utcDate } from '@/lib/fmt'
import { newOrderId, openTill, parsePriceList, type Till, TillBusyError, type TillSettings } from '@/lib/till'

const REASON: Record<RejectReason, string> = {
  'wrong-payee': 'This certificate is for another shop.',
  insufficient: 'Not enough left on this certificate for this order.',
  expiring: 'This certificate expires too soon to accept.',
  closed: 'This certificate is closed.',
  'unknown-certificate': 'There is no such certificate on the blockchain.',
  'bad-signature': 'The signature does not match the certificate. Do not hand over the goods.',
  malformed: 'That is not a Flying Money payment code.',
  'different-order': 'This code was made for a different order. Ask the customer to scan the current price code.',
  'over-first-visit-limit': 'Offline, and this new customer is over your first-visit limit.',
  'wrong-chain': 'This code is for a different network.',
  flagged: 'This payment was flagged when it was checked online. Do not accept it.',
}

type Tab = 'sell' | 'ledger' | 'settings'
type Order = { id: string; price: bigint; label: string; qr: string }

export function Pos({ chainKey, payee, initialName }: { chainKey: ChainKey; payee: Hex; initialName?: string }) {
  const chain = getChain(chainKey)
  const [till, setTill] = useState<Till | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('sell')
  const online = useOnline()

  useEffect(() => {
    let t: Till | null = null
    let gone = false
    openTill(chainKey, payee, initialName)
      .then((x) => {
        if (gone) return x.release() // unmounted while opening: let the next mount take the lock
        t = x
        setTill(x)
      })
      .catch((e) => {
        if (!gone) setFatal(e instanceof TillBusyError ? e.message : `Could not open the till: ${(e as Error).message}`)
      })
    return () => {
      gone = true
      t?.release()
    }
  }, [chainKey, payee, initialName])

  // Re-check unverified payments whenever the connection returns (§6.8).
  useEffect(() => {
    if (online && till) void till.counter.reconcile().catch(() => {})
  }, [online, till])

  if (fatal)
    return (
      <div role="alert" className="sheet mt-6 p-8">
        <p className="font-display text-2xl font-semibold">{fatal}</p>
        <p className="mt-2 text-ink-2">
          One device, one tab: a till keeps the shop’s ledger in this browser, and two copies would disagree.
        </p>
      </div>
    )
  if (!till) return <p className="mt-10 text-ink-2">Opening the till…</p>

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-semibold tracking-tight">{till.settings.name}</h1>
          <p className="mt-1 text-sm text-ink-2">
            Paid to <span className="font-mono">{short(payee)}</span> on {chain.chain.name}
          </p>
        </div>
        <div role="tablist" aria-label="Till" className="flex gap-1 rounded-[4px] border border-ink/25 bg-paper/70 p-1">
          {(
            [
              ['sell', 'Sell'],
              ['ledger', 'Today’s ledger'],
              ['settings', 'Settings'],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
              className={`min-h-10 rounded-[3px] px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-indigo ${tab === k ? 'bg-ink text-paper' : 'text-ink-2 hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-6">
        {tab === 'sell' && <Sell till={till} />}
        {tab === 'ledger' && <Ledger till={till} chainKey={chainKey} online={online} />}
        {tab === 'settings' && <Settings till={till} />}
      </div>
    </div>
  )
}

// ── Sell: price QR → scan the sealed note → result ───────────────────────────────
function Sell({ till }: { till: Till }) {
  const items = parsePriceList(till.settings.priceList)
  const [amount, setAmount] = useState('')
  const [order, setOrder] = useState<Order | null>(null)
  const [result, setResult] = useState<CounterResult | null>(null)
  const [busy, setBusy] = useState(false)
  const amountId = useId()

  const valid = /^\d+(\.\d{1,6})?$/.test(amount) && parseUnits(amount, 6) > 0n

  function charge(label: string, value: string) {
    const price = parseUnits(value, 6)
    const id = newOrderId()
    setResult(null)
    setOrder({ id, price, label, qr: till.counter.priceQr(price, id) })
  }

  async function scanned(text: string) {
    if (!order || busy) return
    setBusy(true)
    try {
      setResult(await till.counter.accept(text, order.price, order.id))
    } finally {
      setBusy(false)
    }
  }

  if (!order)
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <section className="sheet p-6" aria-labelledby="menu-t">
          <h2 id="menu-t" className="font-display text-2xl font-semibold">
            Tap an item
          </h2>
          {items.length === 0 ? (
            <p className="mt-2 text-ink-2">No price list yet. Add one in Settings, or type an amount.</p>
          ) : (
            <ul className="mt-4 grid grid-cols-2 gap-3">
              {items.map((it) => (
                <li key={`${it.label}-${it.amount}`}>
                  <button
                    type="button"
                    onClick={() => charge(it.label, it.amount)}
                    className="flex min-h-16 w-full flex-col items-start justify-center rounded-md border border-line bg-paper px-4 py-3 text-left hover:border-seal focus-visible:outline-2 focus-visible:outline-indigo"
                  >
                    <span className="font-medium">{it.label}</span>
                    <span className="font-mono text-sm text-ink-2">{it.amount} USDC</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="sheet p-6" aria-labelledby="amount-t">
          <h2 id="amount-t" className="font-display text-2xl font-semibold">
            Or type an amount
          </h2>
          <form
            className="mt-4 grid gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (valid) charge('Custom amount', amount)
            }}
          >
            <label htmlFor={amountId} className="text-sm font-medium">
              Amount in USDC
            </label>
            <input
              id={amountId}
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(',', '.'))}
              placeholder="3.50"
              className="min-h-14 rounded border border-line bg-paper px-4 font-mono text-3xl lining-nums"
            />
            <div className="grid grid-cols-3 gap-2" aria-hidden>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫'].map((k) => (
                <button
                  key={k}
                  type="button"
                  tabIndex={-1}
                  onClick={() => setAmount((a) => (k === '⌫' ? a.slice(0, -1) : a + k))}
                  className="min-h-12 rounded border border-line bg-paper-2 font-mono text-xl hover:border-seal"
                >
                  {k}
                </button>
              ))}
            </div>
            <button type="submit" disabled={!valid} className={buttonClass('primary')}>
              Charge {valid ? `${amount} USDC` : ''}
            </button>
          </form>
        </section>
      </div>
    )

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      <section className="sheet p-6 text-center" aria-labelledby="price-t">
        <p className="smallcaps text-sm text-ink-2">Step 1 · the customer scans this</p>
        <h2 id="price-t" className="mt-1 font-display text-4xl font-semibold lining-nums">
          {order.label} · {usdc(order.price)} USDC
        </h2>
        <div className="mx-auto mt-4 max-w-72">
          <QrCode value={order.qr} label={`Price code for ${usdc(order.price)} USDC`} />
        </div>
        <details className="mt-3 text-left text-sm">
          <summary className="cursor-pointer text-ink-2">Copy the price code (for a second window)</summary>
          <textarea
            readOnly
            value={order.qr}
            aria-label="Price code"
            className="mt-2 h-24 w-full rounded border border-line bg-paper-2 p-2 font-mono text-xs"
            onFocus={(e) => e.currentTarget.select()}
          />
        </details>
        <button type="button" className={`${buttonClass('secondary')} mt-4`} onClick={() => setOrder(null)}>
          Cancel order
        </button>
      </section>
      <section className="sheet p-6" aria-labelledby="scan-t" aria-live="polite">
        <p className="smallcaps text-sm text-ink-2">Step 2 · scan the customer’s sealed note</p>
        <h2 id="scan-t" className="sr-only">
          Scan the customer’s code
        </h2>
        {result ? (
          <ResultCard
            result={result}
            onAgain={() => setResult(null)}
            onNext={() => {
              setOrder(null)
              setResult(null)
              setAmount('')
            }}
          />
        ) : (
          <div className="mt-3">
            <QrScanner
              prompt="Point the camera at the QR on the customer’s phone."
              pasteLabel="Or paste the customer’s code"
              onResult={(t) => void scanned(t)}
            />
            {busy && <p className="mt-2 text-sm text-ink-2">Checking…</p>}
          </div>
        )}
      </section>
    </div>
  )
}

function ResultCard({ result, onAgain, onNext }: { result: CounterResult; onAgain: () => void; onNext: () => void }) {
  if (result.status === 'GUARANTEED')
    return (
      <div className="mt-3 text-center">
        <div className="mx-auto w-fit">
          <Seal size={96} animate label="Guaranteed: sealed by the certificate" />
        </div>
        <p className="mt-4 font-display text-4xl font-semibold lining-nums">Accepted {usdc(result.price)}</p>
        {result.remaining !== undefined && (
          <p className="mt-1 text-lg text-ink-2 lining-nums">Customer remaining {usdc(result.remaining)}</p>
        )}
        <p className="mt-3 text-sm text-ink-2">
          Guaranteed: backed by money set aside for your shop.
          {result.expiresAt !== undefined && <> Collect before {utcDate(result.expiresAt - 1800n)}.</>}
          {result.replay && ' (This code was already accepted; nothing was charged twice.)'}
        </p>
        <button type="button" className={`${buttonClass('primary')} mt-6`} onClick={onNext}>
          Next customer
        </button>
      </div>
    )
  if (result.status === 'UNVERIFIED')
    return (
      <div className="mt-3 rounded-md border-2 border-amber p-6 text-center">
        <p className="smallcaps text-sm font-semibold text-amber">Unverified · merchant risk</p>
        <p className="mt-2 font-display text-3xl font-semibold lining-nums">{usdc(result.price)} not guaranteed</p>
        <p className="mt-2 text-ink-2">
          First-time customer while offline: your risk up to {usdc(result.riskLimit ?? 0n)} USDC. It will be checked
          when you are back online.
        </p>
        <button type="button" className={`${buttonClass('primary')} mt-6`} onClick={onNext}>
          Next customer
        </button>
      </div>
    )
  return (
    <div className="mt-3 rounded-md border border-line bg-paper-2 p-6 text-center">
      <p className="smallcaps text-sm font-semibold text-ink-2">Rejected</p>
      <p className="mt-2 text-lg">{REASON[result.reason ?? 'malformed']}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button type="button" className={buttonClass('primary')} onClick={onAgain}>
          Scan again
        </button>
        <button type="button" className={buttonClass('secondary')} onClick={onNext}>
          Cancel order
        </button>
      </div>
    </div>
  )
}

// ── Ledger: accepted by you → collected on-chain ─────────────────────────────────
function Ledger({ till, chainKey, online }: { till: Till; chainKey: ChainKey; online: boolean }) {
  const chain = getChain(chainKey)
  const [rows, setRows] = useState<
    Array<{ key: string; id: Hex; consumed: bigint; redeemed: bigint; toCollect: bigint }>
  >([])
  const [pending, setPending] = useState<PendingRedemption[]>([])
  const [unverified, setUnverified] = useState<UnverifiedRecord[]>([])
  const [checking, setChecking] = useState(false)
  const publicClient = usePublicClient({ chainId: chain.chain.id })
  const { data: wallet } = useWalletClient({ chainId: chain.chain.id })
  const { address } = useAccount()
  const walletChain = useChainId()
  const tx = useTx(publicClient)

  const load = useCallback(async () => {
    const p = await till.store.pendingRedemptions(chain.chain.id)
    setPending(p)
    const snap = till.store.snapshot()
    setRows(
      snap.certs.map(([key, r]) => {
        const pr = p.find((x) => x.key === key)
        return {
          key,
          id: key.split(':')[1] as Hex,
          consumed: BigInt(r.consumed),
          redeemed: BigInt(r.redeemed),
          toCollect: pr ? pr.note.cumulative - pr.redeemedOnChain : 0n,
        }
      }),
    )
    setUnverified(await till.counter.unverified())
  }, [till, chain.chain.id])
  useEffect(() => {
    void load()
  }, [load])

  const total = pending.reduce((s, p) => s + (p.note.cumulative - p.redeemedOnChain), 0n)

  async function collect() {
    if (!wallet || !publicClient || !address || pending.length === 0) return
    const batch = pending
    const r = await tx.run(async () => {
      const { request } = await publicClient.simulateContract({
        account: address,
        address: chain.flyingMoney!,
        abi: flyingMoneyAbi,
        functionName: 'redeemMany',
        args: [
          batch.map((p) => ({
            certificateId: p.note.certificateId,
            cumulative: p.note.cumulative,
            memo: p.note.memo,
            signature: p.note.sig,
          })),
        ],
      })
      return wallet.writeContract(request)
    })
    if (r) {
      for (const p of batch) await till.store.markRedeemed(p.key, p.note.cumulative, r.transactionHash)
      await load()
    }
  }

  async function recheck() {
    setChecking(true)
    try {
      await till.counter.reconcile()
      await load()
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="grid gap-8">
      <section className="sheet p-6" aria-labelledby="collect-t">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 id="collect-t" className="font-display text-3xl font-semibold lining-nums">
              To collect: {usdc(total)} USDC
            </h2>
            <p className="mt-1 text-ink-2">
              Accepted by you, not yet collected on-chain. One transaction collects everything; anyone may send it, and
              the money only ever goes to your shop’s address.
            </p>
          </div>
          <WalletButton chain={chain} />
        </div>
        <button
          type="button"
          className={`${buttonClass('primary')} mt-4`}
          disabled={
            !online || total === 0n || !wallet || walletChain !== chain.chain.id || tx.state.phase === 'confirming'
          }
          onClick={() => void collect()}
        >
          Collect {usdc(total)} USDC
        </button>
        {!online && <p className="mt-2 text-sm text-ink-2">Collecting needs a connection.</p>}
        <TxStatus state={tx.state} explorer={chain.explorer} onCheck={(h) => void tx.watch(h)} />
      </section>

      <section className="sheet overflow-x-auto p-6" aria-labelledby="ledger-t">
        <h2 id="ledger-t" className="font-display text-2xl font-semibold">
          Certificates at this till
        </h2>
        {rows.length === 0 ? (
          <p className="mt-2 text-ink-2">No guaranteed payments yet.</p>
        ) : (
          <table className="ledger-table mt-4 w-full text-left text-sm">
            <thead>
              <tr>
                <th className="py-2 pr-3">Certificate</th>
                <th className="px-3 py-2 text-right">Accepted by you</th>
                <th className="px-3 py-2 text-right">Collected on-chain</th>
                <th className="px-3 py-2 text-right">To collect</th>
              </tr>
            </thead>
            <tbody className="lining-nums tabular-nums">
              {rows.map((r) => (
                <tr key={r.key}>
                  <td className="py-2 pr-3 font-mono">
                    <a className="text-indigo underline" href={`/c/${chainKey}/${r.id}`}>
                      {short(r.id)}
                    </a>
                  </td>
                  <td className="px-3 py-2 text-right">{usdc(r.consumed)}</td>
                  <td className="px-3 py-2 text-right">{usdc(r.redeemed)}</td>
                  <td className="px-3 py-2 text-right">{usdc(r.toCollect)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="sheet p-6" aria-labelledby="unv-t">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="unv-t" className="font-display text-2xl font-semibold">
            Unverified (accepted offline)
          </h2>
          <button
            type="button"
            className={buttonClass('secondary')}
            disabled={!online || checking}
            onClick={() => void recheck()}
          >
            {checking ? 'Checking…' : 'Check now'}
          </button>
        </div>
        {unverified.length === 0 ? (
          <p className="mt-2 text-ink-2">
            None. Offline payments from new customers appear here until they are checked.
          </p>
        ) : (
          <ul className="mt-3 grid gap-2">
            {unverified.map((u) => (
              <li
                key={u.requestId}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-2"
              >
                <span className="font-mono text-sm">{short(u.certificateId)}</span>
                <span className="lining-nums">{usdc(BigInt(u.price))} USDC</span>
                <span
                  className={`smallcaps text-sm font-semibold ${u.state === 'PROMOTED' ? 'text-ink' : u.state === 'FLAGGED' ? 'text-seal' : 'text-amber'}`}
                >
                  {u.state === 'PROMOTED'
                    ? 'Checked · now guaranteed'
                    : u.state === 'FLAGGED'
                      ? `Flagged: ${REASON[u.reason ?? 'malformed']}`
                      : 'Waiting for a connection'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

// ── Settings (§12.5 step 4) ─────────────────────────────────────────────────────
function Settings({ till }: { till: Till }) {
  const [s, setS] = useState<TillSettings>(till.settings)
  const [limit, setLimit] = useState(usdc(BigInt(till.settings.firstVisitLimit)))
  const [saved, setSaved] = useState(false)
  const ids = useId()
  const limitOk = /^\d+(\.\d{1,6})?$/.test(limit)

  return (
    <form
      className="sheet grid max-w-2xl gap-6 p-6"
      onSubmit={async (e) => {
        e.preventDefault()
        if (!limitOk) return
        await till.saveSettings({ ...s, firstVisitLimit: parseUnits(limit, 6).toString() })
        setSaved(true)
        // the first-visit limit is fixed when the till opens: reopen with the new settings
        setTimeout(() => window.location.reload(), 600)
      }}
    >
      <div className="grid gap-1">
        <label htmlFor={`${ids}-n`} className="text-sm font-medium">
          Shop name
        </label>
        <input
          id={`${ids}-n`}
          value={s.name}
          maxLength={60}
          onChange={(e) => setS({ ...s, name: e.target.value })}
          className="min-h-11 rounded border border-line bg-paper px-3"
        />
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${ids}-l`} className="text-sm font-medium">
          First-visit limit (USDC)
        </label>
        <input
          id={`${ids}-l`}
          inputMode="decimal"
          value={limit}
          onChange={(e) => setLimit(e.target.value.replace(',', '.'))}
          className="min-h-11 rounded border border-line bg-paper px-3 font-mono"
          aria-describedby={`${ids}-lh`}
        />
        <p id={`${ids}-lh`} className="text-sm text-ink-2">
          When you are offline, a customer this till has never seen can pay up to this much per certificate, at your own
          risk. It is checked when you reconnect.
        </p>
      </div>
      <div className="grid gap-1">
        <label htmlFor={`${ids}-p`} className="text-sm font-medium">
          Price list (one item per line: name, then price)
        </label>
        <textarea
          id={`${ids}-p`}
          value={s.priceList}
          onChange={(e) => setS({ ...s, priceList: e.target.value })}
          rows={5}
          className="rounded border border-line bg-paper p-3 font-mono text-sm"
        />
      </div>
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={s.primary}
          onChange={(e) => setS({ ...s, primary: e.target.checked })}
          className="mt-1 accent-[var(--seal)]"
        />
        <span>
          <span className="font-medium">This is the shop’s primary till.</span>
          <span className="block text-sm text-ink-2">
            Use one till per shop. A second device would keep its own ledger, and the guarantee needs one ledger that
            knows every payment.
          </span>
        </span>
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" className={buttonClass('primary')} disabled={!limitOk}>
          Save settings
        </button>
        {saved && <span role="status">Saved. Reopening the till…</span>}
      </div>
    </form>
  )
}
