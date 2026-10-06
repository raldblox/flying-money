'use client'
import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import { encodeHeader, type Hex, readCertificate } from '@flying-money/core'
import type { CounterResult } from '@flying-money/server/browser'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPublicClient, http } from 'viem'
import { CarryReceive, CarrySend } from '@/components/carry/carry'
import { CarryLink, ModePicker, useCarryMode } from '@/components/carry/carry-link'
import { Keepsake, type KeepsakeData } from '@/components/carry/keepsake'
import { NetworkPicker, type PickerNetwork } from '@/components/network-picker'
import { buttonClass } from '@/components/section'
import { listenForCarried } from '@/lib/carry/channel'
import { PROVERBS } from '@/lib/carry/proverbs'
import { encodeReceipt } from '@/lib/carry/receipt'
import { carriedPrice, slipForOrder } from '@/lib/carry/till'
import { short, usdc } from '@/lib/fmt'
import { newOrderId, openTill, type Till } from '@/lib/till'

const PRICE = 10_000n // one 飛錢 certificate
const SHOP = 'Flying Money tea house'

interface Funded {
  certificateId: Hex
  issueTx: string
  chainName: string
  handOver: string
}
interface Order {
  id: string
  qr: string
}

export function DemoCounter({ chains, payee }: { chains: PickerNetwork[]; payee: Hex }) {
  const [chain, setChain] = useState<ChainKey>(chains[0]?.key ?? 'arbitrum-sepolia')
  const [till, setTill] = useState<Till | null>(null)
  const [tillError, setTillError] = useState<string | null>(null)
  const pretend = useRef(false)
  const [offline, setOffline] = useState(false)
  const [netDown, setNetDown] = useState(false)
  const [funded, setFunded] = useState<Funded | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [origin, setOrigin] = useState('')
  const [version, setVersion] = useState(0)
  const ids = useId()

  useEffect(() => {
    setOrigin(window.location.origin)
    const on = () => setNetDown(!navigator.onLine)
    on()
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', on)
    }
  }, [])

  // the till for this network; its budget reader can pretend to be offline, like a till with no connection
  useEffect(() => {
    let opened: Till | undefined
    let gone = false
    setTill(null)
    setTillError(null)
    const pub = createPublicClient({ transport: http(rpcUrl(chain)) })
    openTill(chain, payee, SHOP, {
      readCertificate: async (_chainId, contract, id) => {
        if (pretend.current) throw new Error('offline (pretend)')
        return readCertificate(pub, contract, id)
      },
    })
      .then((t) => {
        if (gone) t.release()
        else {
          opened = t
          setTill(t)
        }
      })
      .catch((e) => setTillError((e as Error).message))
    return () => {
      gone = true
      opened?.release()
    }
  }, [chain, payee])

  const isOffline = offline || netDown

  async function fund() {
    if (!till) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/demo/counter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chain }),
      })
      const body = (await res.json()) as Funded & { error?: string }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      // the till checks the budget now, while online: that is what lets it accept it later with no connection. Right
      // after the transaction an RPC node may not have it yet, so keep asking for a while.
      const chainId = getChain(chain).chain.id
      let seen = null
      for (let i = 0; i < 20 && !seen; i++) {
        seen = await till.counter.server.certificate(chainId, body.certificateId, true).catch(() => null)
        if (!seen) await new Promise((r) => setTimeout(r, 1000))
      }
      if (!seen)
        throw new Error(
          'The budget was made, but this till couldn’t read it from the network yet. Try again in a minute, before going offline.',
        )
      setFunded(body)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-8 grid gap-6">
      <section className="sheet grid gap-4 p-5" aria-labelledby={`${ids}-1`}>
        <h2 id={`${ids}-1`} className="font-display text-2xl font-semibold">
          1 · Give your phone a budget for this till
        </h2>
        {!funded ? (
          <>
            {chains.length > 1 && (
              <NetworkPicker networks={chains} value={chain} onChange={setChain} label="Network" disabled={busy} />
            )}
            <button
              type="button"
              className={`${buttonClass('primary')} sm:w-fit`}
              onClick={() => void fund()}
              disabled={busy || !till || isOffline}
            >
              {busy ? 'Funding…' : 'Make a 0.05 test USDC budget for my phone'}
            </button>
            {tillError && (
              <p role="alert" className="text-sm text-seal">
                The till couldn’t open: {tillError}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-seal">
                {error}
              </p>
            )}
            <p className="text-xs text-ink-2">One real transaction on the test network you pick. Test money only.</p>
          </>
        ) : (
          <>
            <p className="text-sm text-ink-2">
              Budget <span className="font-mono">{short(funded.certificateId)}</span> on {funded.chainName}, funded in{' '}
              <a href={funded.issueTx} target="_blank" rel="noreferrer" className="text-indigo underline">
                this transaction
              </a>
              . It pays only this till, and this till has already checked it while online.
            </p>
            <p className="text-sm">
              <strong>On your phone:</strong> open this, choose a PIN, and add the budget to your wallet. One device
              only? Open the link in a new tab here.
            </p>
            {origin && (
              <CarrySend
                payload={`${origin}/wallet#${funded.handOver}`}
                href={`${origin}/wallet#${funded.handOver}`}
                title="A budget for your phone"
                carriers={['qr', 'share', 'link', 'text']}
              />
            )}
          </>
        )}
      </section>

      <section className="sheet grid gap-3 p-5" aria-labelledby={`${ids}-2`}>
        <h2 id={`${ids}-2`} className="font-display text-2xl font-semibold">
          2 · Go offline
        </h2>
        <p className="text-sm text-ink-2">
          Switch your phone to airplane mode. For this screen, turn off its Wi-Fi, or pretend:
        </p>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={offline}
            onChange={(e) => {
              pretend.current = e.target.checked
              setOffline(e.target.checked)
            }}
            className="size-5"
          />
          Pretend this till has no internet
        </label>
        <p className={`text-sm font-medium ${isOffline ? 'text-seal' : 'text-ink-2'}`} role="status">
          This till is {isOffline ? 'offline' : 'online'}.
        </p>
      </section>

      {till && funded && <Sell till={till} chain={chain} onSold={() => setVersion((v) => v + 1)} />}
      {till && funded && <Collect till={till} chain={chain} offline={isOffline} version={version} />}
    </div>
  )
}

function Sell({ till, chain, onSold }: { till: Till; chain: ChainKey; onSold: () => void }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [name, setName] = useState('')
  const [result, setResult] = useState<CounterResult | null>(null)
  const [keepsake, setKeepsake] = useState<KeepsakeData | null>(null)
  const [receipt, setReceipt] = useState<string | null>(null)
  const [mode, setMode] = useCarryMode()
  const busy = useRef(false)
  const ids = useId()

  const take = useCallback(
    async (text: string) => {
      if (!order || busy.current || !/^(https?:|fm[12])/.test(text)) return
      busy.current = true
      try {
        const r = await till.counter.accept(slipForOrder(text, order.id), PRICE, order.id)
        setResult(r)
        if (r.status !== 'REJECTED' && r.requestId && r.certificateId) {
          const proverb = Number.parseInt(r.requestId.slice(-4), 16) % PROVERBS.length
          const k: KeepsakeData = {
            serial: r.requestId.slice(-8).toUpperCase(),
            name: name.trim(),
            issuedAt: new Date().toISOString(),
            paid: PRICE.toString(),
            chainId: getChain(chain).chain.id,
            certificateId: r.certificateId,
            proverb: PROVERBS[proverb]!,
          }
          setKeepsake(k)
          recordSale(chain, {
            at: Date.now(),
            requestId: r.requestId,
            certificateId: r.certificateId,
            price: PRICE.toString(),
            status: r.status,
            name: k.name,
          })
          onSold()
          // the product goes back to the phone with the receipt: the phone draws the certificate itself
          setReceipt(
            encodeReceipt({
              memo: r.requestId,
              certificate: r.certificateId,
              price: PRICE,
              status: r.status,
              item: 'A 飛錢 certificate',
              keepsake: { serial: k.serial, name: k.name, issuedAt: k.issuedAt, proverb, chainId: k.chainId },
            }),
          )
        }
      } finally {
        busy.current = false
      }
    },
    [order, till, name, chain, onSold],
  )
  const takeRef = useRef(take)
  takeRef.current = take
  // a slip opened as a link in another tab on this device lands on the waiting order
  useEffect(() => {
    if (!order || result) return
    return listenForCarried('till', (p) => {
      if (!/^fm[12]/.test(p)) return false
      void takeRef.current(p)
      return true
    })
  }, [order, result])

  const next = () => {
    setOrder(null)
    setResult(null)
    setKeepsake(null)
    setReceipt(null)
  }
  const accepted = result !== null && result.status !== 'REJECTED'
  const verdict = (r: CounterResult) =>
    r.status === 'GUARANTEED'
      ? '✓ Accepted and guaranteed: checked on the spot, no internet needed.'
      : r.status === 'UNVERIFIED'
        ? 'Accepted at the shop’s own risk (this till had never checked that budget).'
        : `Refused: ${r.reason}.`

  return (
    <section className="sheet grid gap-4 p-5" aria-labelledby={`${ids}-3`}>
      <h2 id={`${ids}-3`} className="font-display text-2xl font-semibold">
        3 · Buy a 飛錢 certificate, offline
      </h2>
      {!order ? (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            const id = newOrderId()
            next()
            setOrder({ id, qr: till.counter.priceQr(PRICE, id) })
          }}
        >
          <label htmlFor={`${ids}-n`} className="text-sm font-medium">
            Name on the certificate (optional)
          </label>
          <input
            id={`${ids}-n`}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            className="min-h-11 rounded border border-line bg-paper px-3"
          />
          <button type="submit" className={`${buttonClass('primary')} sm:w-fit`}>
            Sell one · 0.01 USDC
          </button>
        </form>
      ) : (
        <div className="grid gap-4">
          <ModePicker mode={mode} onChange={setMode} />
          <p className="text-sm text-ink-2">
            {accepted
              ? 'Paid. The receipt, with the certificate inside, is going back to the phone: keep the phone where it is for a moment and the certificate appears there.'
              : 'On the phone: tap Pay, choose the same way, and approve with the PIN. The rest happens by itself.'}
          </p>
          <CarryLink
            mode={mode}
            send={receipt ?? carriedPrice(order.qr)}
            sendLabel={receipt ? 'Receipt for the phone' : 'Price code for 0.01 USDC'}
            onText={(t) => {
              if (!result || result.status === 'REJECTED') void take(t)
            }}
          />
          {result && (
            <p className={`font-display text-xl font-semibold ${accepted ? '' : 'text-seal'}`} role="status">
              {verdict(result)}
            </p>
          )}
          {keepsake && (
            <details>
              <summary className="cursor-pointer text-sm text-ink-2">See the certificate here too</summary>
              <div className="mt-3">
                <Keepsake
                  data={keepsake}
                  network={getChain(chain).chain.name}
                  statusUrl={`${window.location.origin}/c/${chain}/${keepsake.certificateId}`}
                />
              </div>
            </details>
          )}
          <div className="flex flex-wrap items-center gap-4">
            {accepted ? (
              <button type="button" className={buttonClass('primary')} onClick={next}>
                Next customer
              </button>
            ) : (
              <button type="button" className="text-sm text-indigo underline" onClick={next}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}

interface Row {
  id: Hex
  accepted: bigint
  collected: bigint
}
interface Sale {
  at: number
  requestId: Hex
  certificateId: Hex
  price: string
  status: 'GUARANTEED' | 'UNVERIFIED'
  name: string
}
const salesKey = (chain: ChainKey) => `fm-demo-sales:${chain}`
function recordSale(chain: ChainKey, s: Sale) {
  try {
    const all = JSON.parse(localStorage.getItem(salesKey(chain)) ?? '[]') as Sale[]
    localStorage.setItem(salesKey(chain), JSON.stringify([s, ...all].slice(0, 200)))
  } catch {
    // private mode: the ledger still shows this till's totals
  }
}
function listSales(chain: ChainKey): Sale[] {
  try {
    return JSON.parse(localStorage.getItem(salesKey(chain)) ?? '[]') as Sale[]
  } catch {
    return []
  }
}

/** The till's books: every budget it has taken payments from, what's collected, what's ready, and each sale. */
function Collect({
  till,
  chain,
  offline,
  version,
}: {
  till: Till
  chain: ChainKey
  offline: boolean
  /** bumps after each sale, so the books refresh */
  version: number
}) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; href?: string } | null>(null)
  const [rows, setRows] = useState<Row[]>([])
  const [waiting, setWaiting] = useState(0)
  const [sales, setSales] = useState<Sale[]>([])
  const ids = useId()
  const chainId = getChain(chain).chain.id
  const explorer = getChain(chain).explorer

  const load = useCallback(async () => {
    const snap = till.store.snapshot()
    setRows(
      snap.certs
        .filter(([key]) => key.startsWith(`${chainId}:`))
        .map(([key, r]) => ({
          id: key.split(':')[1] as Hex,
          accepted: BigInt(r.consumed),
          collected: BigInt(r.redeemed),
        }))
        .filter((r) => r.accepted > 0n),
    )
    setWaiting((await till.counter.unverified()).filter((u) => u.state === 'UNVERIFIED').length)
    setSales(listSales(chain))
  }, [till, chain, chainId])
  // biome-ignore lint/correctness/useExhaustiveDependencies: reload the books after each sale (version)
  useEffect(() => {
    void load()
  }, [load, version])

  async function collect() {
    setBusy(true)
    setMsg(null)
    try {
      // payments taken at the shop's own risk (a budget this till hadn't checked) are checked now, then collected too
      const rec = await till.counter.reconcile().catch(() => ({ promoted: 0, flagged: 0, waiting: 0 }))
      const pending = await till.store.pendingRedemptions(chainId)
      if (pending.length === 0) {
        const collected = rows.reduce((s, r) => s + r.collected, 0n)
        setMsg({
          text:
            rows.length === 0 && sales.length === 0
              ? 'No sales on this till yet. Sell something first.'
              : `Nothing new to collect: everything this till accepted is already collected (${usdc(collected)} USDC)${
                  rec.waiting ? `, and ${rec.waiting} taken at the till’s own risk can’t be checked yet` : ''
                }${rec.flagged ? `; ${rec.flagged} turned out not to be covered` : ''}.`,
        })
        return
      }
      const res = await fetch('/api/demo/counter/collect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chain, notes: pending.map((p) => encodeHeader(p.note)) }),
      })
      const body = (await res.json()) as { tx?: string; hash?: Hex; collected?: number; error?: string; note?: string }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      if (body.hash) for (const p of pending) await till.store.markRedeemed(p.key, p.note.cumulative, body.hash)
      setMsg(
        body.tx
          ? {
              text: `Collected ${body.collected} ${body.collected === 1 ? 'budget' : 'budgets'} in one transaction.`,
              href: body.tx,
            }
          : { text: body.note ?? 'Done.' },
      )
    } catch (e) {
      setMsg({ text: (e as Error).message })
    } finally {
      setBusy(false)
      await load()
    }
  }

  const ready = rows.reduce((s, r) => s + (r.accepted > r.collected ? r.accepted - r.collected : 0n), 0n)
  return (
    <section className="sheet grid gap-4 p-5" aria-labelledby={`${ids}-4`}>
      <h2 id={`${ids}-4`} className="font-display text-2xl font-semibold">
        4 · The till’s books, and collecting
      </h2>
      <p className="text-sm text-ink-2">
        Until the till collects, the money waits in each budget, set aside for this till. Collecting sends everything
        ready in one transaction; it needs a connection.
      </p>
      <dl className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded border border-line p-3">
          <dt className="smallcaps text-xs text-ink-2">Ready to collect</dt>
          <dd className="font-display text-2xl font-semibold lining-nums">{usdc(ready)}</dd>
        </div>
        <div className="rounded border border-line p-3">
          <dt className="smallcaps text-xs text-ink-2">Collected</dt>
          <dd className="font-display text-2xl font-semibold lining-nums">
            {usdc(rows.reduce((s, r) => s + r.collected, 0n))}
          </dd>
        </div>
        <div className="rounded border border-line p-3">
          <dt className="smallcaps text-xs text-ink-2">At own risk</dt>
          <dd className="font-display text-2xl font-semibold lining-nums">{waiting}</dd>
        </div>
      </dl>
      <button
        type="button"
        className={`${buttonClass('primary')} sm:w-fit`}
        onClick={() => void collect()}
        disabled={busy || offline}
      >
        {offline ? 'Collecting needs a connection' : busy ? 'Collecting…' : 'Collect now'}
      </button>
      {msg && (
        <p role="status" className="text-sm">
          {msg.text}{' '}
          {msg.href && (
            <a href={msg.href} target="_blank" rel="noreferrer" className="text-indigo underline">
              See the transaction
            </a>
          )}
        </p>
      )}
      {rows.length > 0 && (
        <table className="w-full text-left text-sm">
          <caption className="smallcaps mb-1 text-left text-xs text-ink-2">
            Budgets this till took payments from
          </caption>
          <thead>
            <tr className="text-ink-2">
              <th className="py-1 font-normal">Budget</th>
              <th className="py-1 font-normal">Accepted</th>
              <th className="py-1 font-normal">Collected</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                <td className="py-1.5 font-mono">
                  <a href={`/c/${chain}/${r.id}`} className="text-indigo underline">
                    {short(r.id)}
                  </a>
                </td>
                <td className="py-1.5 font-mono lining-nums">{usdc(r.accepted)}</td>
                <td className="py-1.5 font-mono lining-nums">
                  {usdc(r.collected)}
                  {r.collected >= r.accepted ? ' ✓' : ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {sales.length > 0 && (
        <details open>
          <summary className="cursor-pointer text-sm font-medium">
            {sales.length} {sales.length === 1 ? 'sale' : 'sales'} on this device
          </summary>
          <ul className="mt-2 grid gap-1.5 text-sm">
            {sales.map((s) => (
              <li key={s.requestId} className="flex flex-wrap justify-between gap-2 border-t border-line pt-1.5">
                <span suppressHydrationWarning>
                  {new Date(s.at).toLocaleTimeString()} · 飛錢 certificate{s.name ? ` for ${s.name}` : ''} ·{' '}
                  <span className="text-ink-2">
                    {s.status === 'GUARANTEED' ? 'guaranteed' : 'at own risk'} · budget {short(s.certificateId)}
                  </span>
                </span>
                <span className="font-mono lining-nums">{usdc(BigInt(s.price))}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
      <p className="text-xs text-ink-2">
        Collections happen on {getChain(chain).chain.name}:{' '}
        <a
          href={`${explorer}/address/${getChain(chain).flyingMoney}`}
          target="_blank"
          rel="noreferrer"
          className="underline"
        >
          the contract on the explorer
        </a>
        .
      </p>
    </section>
  )
}
