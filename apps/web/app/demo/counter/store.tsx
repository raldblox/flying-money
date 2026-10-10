'use client'
import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import {
  abandonCounterPayment,
  type CounterCertificate,
  type CounterState,
  confirmCounterPayment,
  counterBalance,
  InsufficientBudgetError,
  memoryCounterStore,
  PendingUnresolvedError,
  prepareCounterPayment,
} from '@flying-money/client/counter'
import { counterRequestId, decodeOffer, encodeHeader, type Hex, readCertificate, signNote } from '@flying-money/core'
import type { CounterResult } from '@flying-money/server/browser'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPublicClient, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { CarrySend } from '@/components/carry/carry'
import { CarryLink, ModePicker, useCarryMode } from '@/components/carry/carry-link'
import { Keepsake, type KeepsakeData } from '@/components/carry/keepsake'
import { Journey } from '@/components/demo/journey'
import { NetworkPicker, type PickerNetwork } from '@/components/network-picker'
import { buttonClass } from '@/components/section'
import { PROVERBS } from '@/lib/carry/proverbs'
import { encodeReceipt } from '@/lib/carry/receipt'
import { carriedPrice, slipForOrder } from '@/lib/carry/till'
import { usdc, utcDate } from '@/lib/fmt'
import { newOrderId, openTill, type Till } from '@/lib/till'
import { parseHandOver } from '@/lib/wallet'

// ── the shop ─────────────────────────────────────────────────────────────────
interface Product {
  id: string
  name: string
  icon: string
  price: bigint
  /** one per item in a cart or bag */
  uid?: string
}
const SHELF: Product[] = [
  { id: 'tea', name: 'Green tea', icon: '🍵', price: 10_000n },
  { id: 'dumplings', name: 'Dumplings', icon: '🥟', price: 20_000n },
  { id: 'mooncake', name: 'Mooncake', icon: '🥮', price: 30_000n },
  { id: 'cert', name: 'Flying Money keepsake', icon: '📜', price: 10_000n },
  { id: 'charge', name: 'Phone charge, 10 min', icon: '🔌', price: 10_000n },
  { id: 'map', name: 'Silk Road map', icon: '🗺️', price: 20_000n },
]
const TIPS = [5_000n, 10_000n, 20_000n]

type Role = 'shop' | 'tips'
interface Budget {
  role: Role
  name: string
  cert: CounterCertificate
  key: Hex
  issueTx: string
  handOver: string
  /** handed to the visitor's phone: this page no longer pays from it, so two copies never sign */
  moved: boolean
}
interface Order {
  role: Role
  id: string
  qr: string
  price: bigint
  items: Product[]
}
interface Paid {
  role: Role
  orderId: string
  noteQr: string
  price: bigint
  items: Product[]
  status: CounterResult['status']
  at: number
}
type Badge = 'first' | 'offline' | 'tip' | 'resume' | 'replay' | 'thief' | 'overspend' | 'collect'
const BADGES: Record<Badge, string> = {
  first: 'First purchase',
  offline: 'Paid with the till cut off',
  tip: 'Tipped Mei',
  resume: 'Survived a dead phone',
  replay: 'Paid twice? Charged once',
  thief: 'Stopped a thief',
  overspend: 'Hit the limit',
  collect: 'Collected',
}

// The visitor's budgets are test money with throwaway keys, kept for this browser tab only (sessionStorage), so a
// refresh doesn't lose them. The real wallet seals its keys with a PIN.
const VKEY = 'fm-demo-visitor'
const SKEY = 'fm-demo-visitor-state'

export function Store({ chains, shopPayee, staffPayee }: { chains: PickerNetwork[]; shopPayee: Hex; staffPayee: Hex }) {
  const [chain, setChain] = useState<ChainKey>(chains[0]?.key ?? 'arbitrum-sepolia')
  const [availability, setAvailability] = useState<{ available: boolean; message: string } | null>(null)
  const [availabilityCheck, setAvailabilityCheck] = useState(0)
  const [budgets, setBudgets] = useState<Budget[] | null>(null)
  const [shopTill, setShopTill] = useState<Till | null>(null)
  const [staffTill, setStaffTill] = useState<Till | null>(null)
  const [cut, setCut] = useState(false)
  const cutRef = useRef(false)
  const [funding, setFunding] = useState(false)
  const [fundingStage, setFundingStage] = useState<'requesting' | 'checking'>('requesting')
  const [paying, setPaying] = useState(false)
  const paymentLock = useRef(false)
  const fundingLock = useRef(false)
  const [sellerView, setSellerView] = useState(false)
  const [collectedThrough, setCollectedThrough] = useState(0)
  const [restored, setRestored] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cart, setCart] = useState<Product[]>([])
  const [order, setOrder] = useState<Order | null>(null)
  const [last, setLast] = useState<Paid | null>(null)
  const [bag, setBag] = useState<Array<{ item: Product; keepsake?: KeepsakeData }>>([])
  const [news, setNews] = useState<{ tone: 'ok' | 'no' | 'info'; text: string } | null>(null)
  const [interrupted, setInterrupted] = useState<Role | null>(null)
  const [armDeadPhone, setArmDeadPhone] = useState(false)
  const [badges, setBadges] = useState<Badge[]>([])
  const [onPhone, setOnPhone] = useState(false)
  const [mode, setMode] = useCarryMode()
  const [version, setVersion] = useState(0)
  const backing = useRef(new Map<string, string>())
  const store = useMemo(() => {
    const s = memoryCounterStore(backing.current)
    return {
      load: s.load,
      save: async (c: Parameters<typeof s.save>[0], st: Parameters<typeof s.save>[1]) => {
        await s.save(c, st)
        try {
          sessionStorage.setItem(SKEY, JSON.stringify([...backing.current]))
        } catch {
          // private mode: the state lives as long as the page
        }
      },
    }
  }, [])
  const award = useCallback((b: Badge) => setBadges((all) => (all.includes(b) ? all : [...all, b])), [])

  // restore this tab's visitor, if any
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(VKEY)
      if (v) {
        const saved = JSON.parse(v) as {
          chain: ChainKey
          budgets: Array<Omit<Budget, 'cert'> & { cert: Record<string, string | number> }>
        }
        setChain(saved.chain)
        setBudgets(
          saved.budgets.map((b) => ({
            ...b,
            cert: {
              ...(b.cert as unknown as CounterCertificate),
              faceValue: BigInt(b.cert.faceValue as string),
              expiresAt: BigInt(b.cert.expiresAt as string),
            },
          })),
        )
      }
      const ui = sessionStorage.getItem('fm-demo-journey')
      if (ui) {
        const saved = JSON.parse(ui, (key, value) => (key === 'price' ? BigInt(value) : value))
        setOrder(saved.order ?? null)
        setLast(saved.last ?? null)
        setBag(saved.bag ?? [])
        setBadges(saved.badges ?? [])
        setInterrupted(saved.interrupted ?? null)
        setCollectedThrough(saved.collectedThrough ?? 0)
        setOnPhone(Boolean(saved.onPhone))
      }
      const st = sessionStorage.getItem(SKEY)
      if (st) for (const [k, val] of JSON.parse(st) as Array<[string, string]>) backing.current.set(k, val)
    } catch {
      // nothing to restore
    } finally {
      setRestored(true)
    }
  }, [])
  useEffect(() => {
    if (!restored) return
    try {
      sessionStorage.setItem(
        'fm-demo-journey',
        JSON.stringify({ order, last, bag, badges, interrupted, collectedThrough, onPhone }, (_key, value) =>
          typeof value === 'bigint' ? value.toString() : value,
        ),
      )
    } catch {
      /* temporary mode: keep the current page usable */
    }
  }, [restored, order, last, bag, badges, interrupted, collectedThrough, onPhone])
  useEffect(() => {
    if (order) document.getElementById('payment-review')?.focus()
  }, [order])
  useEffect(() => {
    const abort = new AbortController()
    if (budgets) return () => abort.abort()
    setAvailability(null)
    void fetch(`/api/demo/counter?chain=${encodeURIComponent(chain)}&check=${availabilityCheck}`, {
      signal: abort.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        if (!response.ok) throw new Error()
        return response.json()
      })
      .then((value) => {
        if (!abort.signal.aborted) setAvailability(value)
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setAvailability({
            available: false,
            message: 'Counter sponsorship could not be checked. Check again or watch the illustration.',
          })
      })
    return () => abort.abort()
  }, [chain, budgets, availabilityCheck])
  const saveVisitor = (c: ChainKey, b: Budget[]) => {
    try {
      sessionStorage.setItem(
        VKEY,
        JSON.stringify({
          chain: c,
          budgets: b.map((x) => ({
            ...x,
            cert: { ...x.cert, faceValue: x.cert.faceValue.toString(), expiresAt: x.cert.expiresAt.toString() },
          })),
        }),
      )
    } catch {
      // private mode
    }
  }

  // the two tills (the shop and Mei), whose only connection is reading budgets from the chain: "cut" stops it
  useEffect(() => {
    const opened: Till[] = []
    let gone = false
    setShopTill(null)
    setStaffTill(null)
    const pub = createPublicClient({ transport: http(rpcUrl(chain)) })
    const readCert = async (_c: number, contract: Hex, id: Hex) => {
      if (cutRef.current) throw new Error('the till’s connection is cut')
      return readCertificate(pub, contract, id)
    }
    void (async () => {
      try {
        const a = await openTill(chain, shopPayee, 'Tea House', { readCertificate: readCert })
        if (gone) {
          a.release()
          return
        }
        opened.push(a)
        const b = await openTill(chain, staffPayee, 'Mei', { readCertificate: readCert })
        if (gone) {
          a.release()
          b.release()
          return
        }
        opened.push(b)
        setShopTill(a)
        setStaffTill(b)
      } catch (e) {
        for (const t of opened) t.release()
        if (gone) return
        setError(`The tills couldn’t open: ${(e as Error).message}`)
      }
    })()
    return () => {
      gone = true
      for (const t of opened) t.release()
    }
  }, [chain, shopPayee, staffPayee])

  const setConnection = (isCut: boolean) => {
    cutRef.current = isCut
    setCut(isCut)
    if (!isCut) {
      void shopTill?.recover()
      void staffTill?.recover()
    }
    setNews({
      tone: 'info',
      text: isCut
        ? 'The till’s connection is cut: it can’t reach the blockchain. Payments from budgets it has already checked are still accepted, and guaranteed.'
        : 'Connection back. The till can collect now.',
    })
  }

  async function getMoney() {
    if (!shopTill || !staffTill || fundingLock.current || !availability?.available) return
    fundingLock.current = true
    setFundingStage('requesting')
    setFunding(true)
    setError(null)
    try {
      const res = await fetch('/api/demo/counter', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chain }),
      })
      const body = (await res.json()) as {
        error?: string
        note?: string
        contract: Hex
        budgets: Array<{
          role: Role
          name: string
          certificateId: Hex
          payee: Hex
          face: string
          expiresAt: string
          issueTx: string
          handOver: string
        }>
      }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      const chainId = getChain(chain).chain.id
      setFundingStage('checking')
      const list: Budget[] = body.budgets.map((b) => {
        const h = parseHandOver(`#${b.handOver}`)
        if (!h) throw new Error('a budget came back malformed')
        return {
          role: b.role,
          name: b.name,
          key: h.key,
          issueTx: b.issueTx,
          handOver: b.handOver,
          moved: false,
          cert: {
            chainId,
            contract: body.contract,
            id: b.certificateId,
            payee: b.payee,
            faceValue: BigInt(b.face),
            expiresAt: BigInt(b.expiresAt),
          },
        }
      })
      setBudgets(list)
      saveVisitor(chain, list)
      // both tills check both budgets now, while connected: that's what lets them decide alone later, offline
      for (const b of body.budgets)
        for (const t of [shopTill, staffTill]) {
          let seen = null
          for (let i = 0; i < 20 && !seen; i++) {
            seen = await t.counter.server.certificate(chainId, b.certificateId, true).catch(() => null)
            if (!seen) await new Promise((r) => setTimeout(r, 1000))
          }
          if (!seen)
            throw new Error(
              'Your funded budgets are saved in this tab, but the till could not check them yet. Stay connected for your first purchase; do not claim again.',
            )
        }
      setNews({
        tone: 'ok',
        text:
          body.note ??
          'Your budgets are ready: 0.10 test USDC for Tea House and a separate 0.05 for Mei. Choose an item to begin.',
      })
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setFunding(false)
      fundingLock.current = false
    }
  }

  const budget = (r: Role) => budgets?.find((b) => b.role === r) ?? null
  const tillOf = (r: Role) => (r === 'shop' ? shopTill : staffTill)

  // ── a payment on this screen: the visitor's wallet signs, the slip crosses, the till checks ───────────────────
  async function pay(o: Order, opts: { resume?: boolean } = {}) {
    if (paymentLock.current) return
    paymentLock.current = true
    setPaying(true)
    try {
      await payOnce(o, opts)
    } catch (e) {
      setError(`Payment interrupted: ${(e as Error).message}. Keep this tab open and retry the same payment.`)
    } finally {
      paymentLock.current = false
      setPaying(false)
    }
  }
  async function payOnce(o: Order, opts: { resume?: boolean } = {}) {
    const b = budget(o.role)
    const till = tillOf(o.role)
    if (!b || !till) return
    setError(null)
    let noteQr: string
    try {
      const r = await prepareCounterPayment({
        store,
        spender: privateKeyToAccount(b.key),
        certificate: b.cert,
        offer: decodeOffer(o.qr),
      })
      noteQr = r.noteQr
    } catch (e) {
      if (e instanceof InsufficientBudgetError) {
        award('overspend')
        setNews({
          tone: 'no',
          text: `Not enough left: ${usdc(counterBalance(b.cert, await store.load(b.cert)))} on this budget, and nothing was signed. The limit is in the budget itself.`,
        })
      } else if (e instanceof PendingUnresolvedError) {
        setInterrupted(o.role)
        setNews({ tone: 'info', text: 'There’s an open payment on this budget. Resume it or cancel it below.' })
      } else setNews({ tone: 'no', text: (e as Error).message })
      return
    }
    if (armDeadPhone && !opts.resume) {
      setArmDeadPhone(false)
      setInterrupted(o.role)
      setNews({
        tone: 'info',
        text: 'The visitor’s phone died just after signing the slip, before the till read it. Nothing is lost: the slip is saved in this demo tab. Resume it, or cancel it.',
      })
      return
    }
    const result = await till.counter.accept(noteQr, o.price, o.id)
    await settle(o, noteQr, result, b)
    if (opts.resume && result.status !== 'REJECTED') award('resume')
  }

  async function settle(o: Order, noteQr: string, result: CounterResult, b: Budget) {
    if (result.status === 'REJECTED') {
      setNews({ tone: 'no', text: `The till refused it: ${result.reason}. Nothing was charged.` })
      return
    }
    await confirmCounterPayment(store, b.cert)
    setInterrupted(null)
    setLast({
      role: o.role,
      orderId: o.id,
      noteQr,
      price: o.price,
      items: o.items,
      status: result.status,
      at: Date.now(),
    })
    award(o.role === 'tips' ? 'tip' : 'first')
    if (cutRef.current) award('offline')
    if (o.role === 'shop') {
      const chainId = getChain(chain).chain.id
      setBag((bg) => [
        ...o.items.map((item) => ({
          item,
          ...(item.id === 'cert' && result.requestId
            ? {
                keepsake: {
                  serial: result.requestId.slice(-8).toUpperCase(),
                  name: '',
                  issuedAt: new Date().toISOString(),
                  paid: item.price.toString(),
                  chainId,
                  certificateId: b.cert.id,
                  proverb: PROVERBS[Number.parseInt(result.requestId.slice(-4), 16) % PROVERBS.length]!,
                },
              }
            : {}),
        })),
        ...bg,
      ])
      setCart([])
    }
    setOrder(null)
    setVersion((v) => v + 1)
    setNews({
      tone: 'ok',
      text:
        o.role === 'tips'
          ? `Mei got your ${usdc(o.price)} tip, from the budget set aside for tips.`
          : `Paid ${usdc(o.price)}${cutRef.current ? ', with the till cut off from the internet' : ''}. ${
              result.status === 'GUARANTEED'
                ? 'Guaranteed: the till had checked this budget.'
                : 'Taken at the till’s own risk.'
            }`,
    })
  }

  async function cancelOpen(r: Role) {
    const b = budget(r)
    if (!b) return
    await abandonCounterPayment(store, b.cert)
    setInterrupted(null)
    setOrder(null)
    setNews({
      tone: 'info',
      text: 'Cancelled. The till never read that slip, so nothing was charged, and the budget is as it was.',
    })
  }

  function checkout(role: Role, items: Product[], price: bigint) {
    const till = tillOf(role)
    if (!till || price === 0n) return
    const id = newOrderId()
    setOrder({ role, id, qr: till.counter.priceQr(price, id), price, items })
  }

  // ── "what if" scenarios ────────────────────────────────────────────────────────
  async function payTwice() {
    if (!last) return
    const till = tillOf(last.role)
    if (!till) return
    const r = await till.counter.accept(last.noteQr, last.price, last.orderId)
    award('replay')
    setNews({
      tone: 'ok',
      text: r.replay
        ? `The same slip again: the till recognises it and shows the same result. Charged once, ${usdc(last.price)}, not twice.`
        : `The till’s answer: ${r.status}.`,
    })
  }
  async function thief() {
    const b = budget('shop')
    if (!b || !staffTill) return
    // a thief with the visitor's Tea House key tries to pay someone else (here: Mei's till) with it
    const id = newOrderId()
    const note = await signNote(privateKeyToAccount(b.key), b.cert.chainId, b.cert.contract, {
      certificateId: b.cert.id,
      cumulative: b.cert.faceValue,
      memo: counterRequestId(id),
    })
    const r = await staffTill.counter.accept(encodeHeader(note), 10_000n, id)
    award('thief')
    setNews({
      tone: 'ok',
      text:
        r.status === 'REJECTED'
          ? `Refused (${r.reason}): this budget is earmarked for the Tea House. Even with the key, a thief can’t pay anyone else with it.`
          : `Unexpected: ${r.status}.`,
    })
  }

  const tillsReady = Boolean(shopTill && staffTill)
  const total = cart.reduce((s, p) => s + p.price, 0n)
  return (
    <div className="mt-8 grid gap-6">
      <Journey
        steps={['Claim budget', 'Choose & sign', 'Receive', 'Try offline', 'Collect']}
        optional={[3]}
        completed={[
          ...(budgets ? [0] : []),
          ...(last ? [1, 2] : []),
          ...(badges.includes('offline') ? [3] : []),
          ...(last && collectedThrough >= last.at ? [4] : []),
        ]}
        current={!budgets ? 0 : !last ? 1 : collectedThrough >= last.at ? 4 : badges.includes('offline') ? 3 : 2}
      />
      {last && collectedThrough >= last.at && (
        <section className="demo-panel p-5" aria-label="What you experienced">
          <h2 className="font-display text-2xl font-semibold">You signed. The seller collected later.</h2>
          <p className="mt-2 text-sm text-ink-2">
            You paid from a sponsored budget without paying gas yourself. The seller accepted your signed payments, then
            collected on-chain.
            {badges.includes('offline')
              ? ' You also paid while the till could not reach the blockchain.'
              : ' The offline experiment is still available if you want to try it.'}
          </p>
          <a href="/demo" className={`${buttonClass('primary')} mt-4`}>
            Let an agent shop for you
          </a>
        </section>
      )}
      {budgets && (
        <div className="demo-panel flex flex-wrap items-center justify-between gap-3 p-4">
          <div>
            <p className="text-sm font-semibold">
              {cut ? 'Till’s blockchain connection interrupted' : 'Till connected to the blockchain'}
            </p>
            <p className="mt-1 text-xs text-ink-2">
              {last
                ? 'Try a purchase while the till cannot reach the chain. Collection waits for reconnection.'
                : 'Start with your first purchase. Then try the offline experiment.'}
            </p>
          </div>
          <button
            type="button"
            className={buttonClass('secondary')}
            onClick={() => setConnection(!cut)}
            disabled={!last || funding}
          >
            {cut ? 'Reconnect the till' : 'Try offline payment'}
          </button>
          {cut && (
            <p className="w-full text-xs text-ink-2">
              Demo scenario: this switch blocks the till’s blockchain reads. Your device stays online. Previously
              checked budgets can still pay.
            </p>
          )}
        </div>
      )}

      {funding && (
        <p role="status" className="rounded border border-line bg-paper p-4 text-sm">
          {fundingStage === 'checking'
            ? 'Budgets funded and saved. Checking them with the till before you shop…'
            : 'Creating temporary spending keys and funding your budgets. Waiting for testnet confirmation…'}
        </p>
      )}
      {news && (
        <p
          role="status"
          className={`rounded-md border-l-4 p-3 text-sm ${news.tone === 'ok' ? 'border-celadon bg-celadon/15' : news.tone === 'no' ? 'border-seal bg-seal/10' : 'border-indigo bg-indigo/10'}`}
        >
          {news.text}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-seal">
          {error}
        </p>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* ── the shop ── */}
        <section className="demo-panel grid content-start gap-4 p-5 sm:p-6" aria-labelledby="shop-t">
          <div className="flex items-baseline justify-between">
            <h2 id="shop-t" className="font-display text-3xl font-semibold">
              Tea House <span className="text-base text-ink-2">· {sellerView ? 'seller view' : 'shop'}</span>
            </h2>
            <span className="smallcaps text-xs text-ink-2">{getChain(chain).chain.name}</span>
          </div>
          <p className="text-sm text-ink-2">
            A tiny demo shop. Pick a keepsake to save, or try a pretend tea-house purchase. Prices are in test USDC.
          </p>
          {budgets && (
            <label className="flex items-center gap-2 text-xs text-ink-2">
              <input type="checkbox" checked={sellerView} onChange={(e) => setSellerView(e.target.checked)} /> Show
              seller controls
            </label>
          )}
          {order ? (
            <OrderView
              order={order}
              onPhone={onPhone}
              mode={mode}
              setMode={setMode}
              till={tillOf(order.role)!}
              chain={chain}
              onPaidByPhone={(r, noteQr) => {
                const b = budget(order.role)
                if (!b || r.status === 'REJECTED') return
                setLast({
                  role: order.role,
                  orderId: order.id,
                  noteQr,
                  price: order.price,
                  items: order.items,
                  status: r.status,
                  at: Date.now(),
                })
                award(order.role === 'tips' ? 'tip' : 'first')
                if (cutRef.current) award('offline')
                setVersion((v) => v + 1)
              }}
              onDone={() => {
                setOrder(null)
                if (order.role === 'shop') setCart([])
              }}
            />
          ) : (
            <>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {SHELF.map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      disabled={!budgets || funding || !tillsReady}
                      onClick={() => setCart((c) => [...c, { ...p, uid: crypto.randomUUID() }])}
                      className="grid w-full place-items-center gap-1 rounded-md border border-line bg-paper p-3 text-center disabled:opacity-60 hover:border-seal focus-visible:outline-2 focus-visible:outline-indigo"
                    >
                      <span className="text-3xl" aria-hidden>
                        {p.icon}
                      </span>
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="font-mono text-xs text-ink-2">{usdc(p.price)} USDC</span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="rounded-md border border-line p-3">
                <p className="smallcaps text-xs text-ink-2">Cart</p>
                {cart.length === 0 ? (
                  <p className="text-sm text-ink-2">
                    {budgets
                      ? 'Choose an item above. The shop prepares your payment request when you review the basket.'
                      : 'Claim your sponsored budget to start shopping.'}
                  </p>
                ) : (
                  <ul className="mt-1 grid gap-1 text-sm">
                    {cart.map((p, i) => (
                      <li key={p.uid ?? p.id} className="flex justify-between">
                        <span>
                          {p.icon} {p.name}
                        </span>
                        <button
                          type="button"
                          className="text-xs text-indigo underline"
                          onClick={() => setCart((c) => c.filter((_, j) => j !== i))}
                        >
                          remove {usdc(p.price)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {cart.length > 0 && (
                  <button
                    type="button"
                    className={`${buttonClass('primary')} mt-3 w-full`}
                    onClick={() => checkout('shop', cart, total)}
                  >
                    {sellerView ? 'Prepare request' : 'Review purchase'} · {usdc(total)} USDC
                  </button>
                )}
              </div>
            </>
          )}
        </section>

        {/* ── the visitor ── */}
        <section
          className={`demo-panel grid content-start gap-4 p-5 sm:p-6 lg:sticky lg:top-4 ${!budgets || order ? 'order-first lg:order-none' : ''}`}
          aria-labelledby="visitor-t"
        >
          <h2 id="visitor-t" className="font-display text-3xl font-semibold">
            Your <span className="text-seal">demo wallet</span>
          </h2>
          {!budgets ? (
            <div className="grid gap-3">
              <p className="text-sm text-ink-2">
                Temporary spending keys, kept in this browser tab. They sign payments from your budgets; the money stays
                in the contract. No personal wallet, app installation, or gas token needed.
              </p>
              <div className="rounded border border-line bg-paper-2 p-4 text-sm">
                <p className="font-semibold">Your sponsored spending permission</p>
                <p className="mt-2">0.10 test USDC · Tea House only</p>
                <p className="mt-1">0.05 test USDC · Mei’s tips only</p>
                <p className="mt-2 text-xs text-ink-2">
                  Separate budgets, valid for 3 days. Flying Money pays setup fees. You approve purchases by signing;
                  the seller collects later.
                </p>
              </div>
              <details className="text-sm">
                <summary className="cursor-pointer text-ink-2">
                  Change test network · {getChain(chain).chain.name}
                </summary>
                <div className="mt-3">
                  <NetworkPicker
                    networks={chains}
                    value={chain}
                    onChange={setChain}
                    label="Network"
                    disabled={funding}
                  />
                </div>
              </details>
              {!funding && (
                <div className="text-sm" role="status">
                  <p>{availability?.message ?? 'Checking sponsored budget availability…'}</p>
                  {availability && !availability.available && (
                    <div className="mt-2 flex flex-wrap gap-3">
                      <button type="button" className="underline" onClick={() => setAvailabilityCheck((n) => n + 1)}>
                        Check availability again
                      </button>
                      <a href="/demo#illustration" className="underline">
                        Watch the payment illustration
                      </a>
                    </div>
                  )}
                </div>
              )}
              <button
                type="button"
                className={`${buttonClass('primary')} sm:w-fit`}
                onClick={() => void getMoney()}
                disabled={funding || !tillsReady || !availability?.available}
              >
                {funding
                  ? fundingStage === 'checking'
                    ? 'Checking your funded budgets…'
                    : 'Preparing wallet & funding budgets…'
                  : 'Set up wallet & claim demo budget'}
              </button>
              <p role="status" className="text-xs text-ink-2">
                {funding
                  ? 'Setup uses real testnet transactions. Keep this tab open while confirmation arrives.'
                  : 'The demo server creates these keys. Refresh can resume this tab; closing or clearing browser storage can lose access. This is not a permanent wallet.'}
              </p>
            </div>
          ) : (
            <VisitorView
              budgets={budgets}
              paying={paying || funding}
              last={last}
              collectedThrough={collectedThrough}
              store={store}
              version={version}
              order={order}
              onPhone={onPhone}
              interrupted={interrupted}
              bag={bag}
              chain={chain}
              onPay={() => order && void pay(order)}
              onResume={() => order && void pay(order, { resume: true })}
              onCancel={(r) => void cancelOpen(r)}
              onTip={(amount) => checkout('tips', [], amount)}
              canTip={Boolean(last && last.role === 'shop' && !order)}
              onMove={(r) => {
                const next = budgets.map((b) => (b.role === r ? { ...b, moved: true } : b))
                setBudgets(next)
                saveVisitor(chain, next)
                setOnPhone(true)
              }}
            />
          )}
        </section>
      </div>

      {budgets && last && (
        <details className="demo-panel grid gap-3 p-5">
          <summary className="cursor-pointer font-display text-2xl font-semibold">
            Explore more: tips, retries & spending limits
          </summary>
          <ul className="my-4 flex flex-wrap gap-2" aria-label="What you’ve tried">
            {(Object.keys(BADGES) as Badge[]).map((b) => (
              <li key={b} className="rounded border border-line px-2 py-1 text-xs">
                {badges.includes(b) ? 'Completed: ' : ''}
                {BADGES[b]}
              </li>
            ))}
          </ul>

          <div className="grid gap-2 sm:grid-cols-2">
            <WhatIf
              title="…the internet goes down?"
              text="Cut the till’s connection (top), then buy something. It still checks the slip and accepts it: the budget was checked earlier and can’t be pulled back."
              action={cut ? 'Reconnect' : 'Cut the connection'}
              onClick={() => setConnection(!cut)}
            />
            <WhatIf
              title="…the visitor’s phone dies mid-payment?"
              text={
                armDeadPhone
                  ? 'Armed: the next payment stops just after signing. Then resume it, or cancel it.'
                  : 'The next payment stops right after the phone signs, before the till reads it. Then resume it with the same slip, or cancel it.'
              }
              action={armDeadPhone ? 'Armed' : 'Arm it'}
              onClick={() => setArmDeadPhone(true)}
            />
            <WhatIf
              title="…someone pays twice with the same slip?"
              text="Show the till the last slip again. It recognises the slip and gives the same answer: charged once."
              action="Pay twice"
              onClick={() => void payTwice()}
              disabled={!last}
            />
            <WhatIf
              title="…a thief steals the visitor’s key?"
              text="The thief signs a slip with the Tea House budget and tries to pay Mei with it."
              action="Be the thief"
              onClick={() => void thief()}
            />
          </div>
          <p className="text-xs text-ink-2">
            Spending past the budget? Put more in the cart than is left. The wallet won’t sign it, and the till wouldn’t
            take it.
          </p>
        </details>
      )}

      {budgets && last && shopTill && staffTill && (
        <Books
          tills={[
            { name: 'Tea House', till: shopTill },
            { name: 'Mei (tips)', till: staffTill },
          ]}
          chain={chain}
          cut={cut}
          version={version}
          onCollected={(at) => {
            setCollectedThrough(at)
            award('collect')
            setNews({ tone: 'ok', text: 'Seller collection confirmed. Your accepted purchases are recorded below.' })
          }}
        />
      )}
    </div>
  )
}

function WhatIf({
  title,
  text,
  action,
  onClick,
  disabled,
}: {
  title: string
  text: string
  action: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <div className="grid content-between gap-2 rounded-md border border-line p-3">
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-ink-2">{text}</p>
      </div>
      <button type="button" className={`${buttonClass('secondary')} sm:w-fit`} onClick={onClick} disabled={disabled}>
        {action}
      </button>
    </div>
  )
}

// ── the visitor's wallet ─────────────────────────────────────────────────────
function VisitorView(p: {
  budgets: Budget[]
  paying: boolean
  last: Paid | null
  collectedThrough: number
  store: { load: (c: CounterCertificate) => Promise<CounterState | null> }
  version: number
  order: Order | null
  onPhone: boolean
  interrupted: Role | null
  bag: Array<{ item: Product; keepsake?: KeepsakeData }>
  chain: ChainKey
  onPay: () => void
  onResume: () => void
  onCancel: (r: Role) => void
  onTip: (amount: bigint) => void
  canTip: boolean
  onMove: (r: Role) => void
}) {
  const [left, setLeft] = useState<Record<string, bigint>>({})
  const [open, setOpen] = useState<KeepsakeData | null>(null)
  const [moving, setMoving] = useState<Role | null>(null)
  // biome-ignore lint/correctness/useExhaustiveDependencies: balances refresh after every payment (version)
  useEffect(() => {
    void (async () => {
      const out: Record<string, bigint> = {}
      for (const b of p.budgets) out[b.role] = counterBalance(b.cert, await p.store.load(b.cert))
      setLeft(out)
    })()
  }, [p.budgets, p.version, p.interrupted])
  const payingFrom = p.order ? p.budgets.find((b) => b.role === p.order!.role) : undefined
  const origin = typeof window === 'undefined' ? '' : window.location.origin

  return (
    <div className="grid gap-4">
      <p className="text-xs text-ink-2">
        Temporary demo wallet · keys kept in this tab. Refresh resumes where storage is available; this is not a
        permanent wallet.
      </p>
      <ul className="grid gap-2">
        {p.budgets.map((b) => (
          <li key={b.role} className="rounded-md border border-line p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-medium">{b.role === 'shop' ? 'For the Tea House' : 'For tipping Mei'}</span>
              <span className="font-display text-2xl font-semibold lining-nums">
                {usdc(left[b.role] ?? b.cert.faceValue)} <span className="text-xs font-sans">test USDC</span>
              </span>
            </div>
            <p className="mt-1 text-sm text-ink-2">
              Available · only at {b.role === 'shop' ? 'Tea House' : 'Mei’s tip jar'}
            </p>
            <p className="mt-1 text-xs text-ink-2">Expires {utcDate(b.cert.expiresAt)}</p>
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-indigo">Budget details & funding proof</summary>
              <p className="mt-2 break-all">Seller: {b.cert.payee}</p>
              <p className="mt-1 break-all">Budget: {b.cert.id}</p>
              <a href={b.issueTx} target="_blank" rel="noreferrer" className="mt-2 inline-block text-indigo underline">
                View funding transaction
              </a>
            </details>
            {b.moved ? (
              <p className="mt-1 text-xs font-medium">On your phone now. Pay from there.</p>
            ) : p.last ? (
              <button
                type="button"
                className="mt-3 min-h-11 text-sm text-indigo underline"
                onClick={() => setMoving(b.role)}
              >
                Move it to my phone
              </button>
            ) : null}
            {moving === b.role && !b.moved && (
              <div className="mt-3 grid gap-2 border-t border-line pt-3">
                <p className="text-sm">
                  Scan this with your phone’s camera to open it in the Flying Money wallet, then tap Done. After that,
                  this budget pays only from your phone (so two copies never pay at once).
                </p>
                <CarrySend
                  payload={`${origin}/wallet#${b.handOver}`}
                  href={`${origin}/wallet#${b.handOver}`}
                  title={b.role === 'shop' ? 'Your Tea House budget' : 'Your tips budget'}
                  carriers={['qr', 'share', 'link']}
                />
                <button
                  type="button"
                  className={`${buttonClass('primary')} sm:w-fit`}
                  onClick={() => {
                    p.onMove(b.role)
                    setMoving(null)
                  }}
                >
                  Done, it’s on my phone
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {p.interrupted && (
        <div role="alert" className="rounded-md border-l-4 border-amber bg-amber/10 p-3">
          <p className="font-medium">An open payment</p>
          <p className="text-sm text-ink-2">
            The slip was signed and saved on the phone, but the till didn’t read it. Show the same slip again (it can’t
            be charged twice), or cancel it (the till never saw it).
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" className={buttonClass('primary')} onClick={p.onResume} disabled={!p.order}>
              Resume: show the same slip
            </button>
            <button type="button" className={buttonClass('secondary')} onClick={() => p.onCancel(p.interrupted!)}>
              Cancel it
            </button>
          </div>
        </div>
      )}

      {p.order && !p.interrupted && payingFrom && (
        <div
          id="payment-review"
          tabIndex={-1}
          className="rounded-md border-2 border-seal bg-paper p-4 outline-offset-4"
        >
          <p className="font-display text-xl font-semibold">
            {p.order.role === 'tips' ? 'Mei’s tip jar' : 'The Tea House'} · {usdc(p.order.price)} USDC
          </p>
          {payingFrom.moved ? (
            <p className="text-sm text-ink-2">This budget is on your phone: pay with it there (see the till).</p>
          ) : (
            <>
              <p className="text-sm text-ink-2">
                Your wallet signs a payment slip for this purchase. No blockchain transaction or gas payment is needed
                from you.
              </p>
              <p className="mt-2 text-sm">{p.order.items.map((item) => item.name).join(', ') || 'Tip for Mei'}</p>
              <p className="mt-2 text-sm text-ink-2">
                Available: {usdc(left[payingFrom.role] ?? payingFrom.cert.faceValue)} USDC ·{' '}
                {(left[payingFrom.role] ?? payingFrom.cert.faceValue) >= p.order.price
                  ? `After payment: ${usdc((left[payingFrom.role] ?? payingFrom.cert.faceValue) - p.order.price)} USDC`
                  : 'This purchase exceeds your available budget.'}
              </p>
              <button
                type="button"
                disabled={p.paying}
                className={`${buttonClass('primary')} mt-3 w-full`}
                onClick={p.onPay}
              >
                {p.paying ? 'Signing & checking…' : `Sign & pay ${usdc(p.order.price)} USDC`}
              </button>
            </>
          )}
        </div>
      )}

      {p.last && !p.order && (
        <section className="rounded border border-celadon bg-celadon/10 p-4" aria-label="Your latest receipt">
          <p className="smallcaps text-xs">Your latest receipt</p>
          <p className="mt-2 font-display text-2xl font-semibold">
            {p.last.items.map((item) => item.name).join(', ') || 'Tip for Mei'}
          </p>
          <p className="mt-1 text-sm">
            {p.last.role === 'shop' ? 'Tea House' : 'Mei'} · {usdc(p.last.price)} test USDC
          </p>
          <p className="mt-2 text-sm font-medium">
            {p.last.status === 'GUARANTEED'
              ? 'Accepted · covered by a checked budget'
              : 'Accepted at seller’s risk · budget unverified'}
          </p>
          <p className="mt-1 text-sm">
            {p.collectedThrough >= p.last.at ? 'Collected on-chain' : 'Awaiting seller collection'}
          </p>
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer">Receipt details</summary>
            <p className="mt-2 break-all">Order {p.last.orderId}</p>
            <p>{new Date(p.last.at).toLocaleString()}</p>
          </details>
        </section>
      )}
      {p.canTip && p.budgets.some((b) => b.role === 'tips') && (
        <details className="rounded-md border border-line p-3">
          <summary className="cursor-pointer font-medium">Tip Mei from your separate tips budget</summary>
          <p className="font-medium">Tip Mei, who served you?</p>
          <p className="text-xs text-ink-2">
            A second seller, paid from a second earmarked budget: one payment choice per seller, each guaranteed.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {TIPS.map((t) => (
              <button key={t.toString()} type="button" className={buttonClass('secondary')} onClick={() => p.onTip(t)}>
                {usdc(t)}
              </button>
            ))}
          </div>
        </details>
      )}

      <div>
        <p className="smallcaps text-xs text-ink-2">Your purchases · demo items</p>
        {p.bag.find((entry) => entry.keepsake)?.keepsake && (
          <button
            type="button"
            className={`${buttonClass('primary')} my-3 w-full`}
            onClick={() => setOpen(p.bag.find((entry) => entry.keepsake)!.keepsake!)}
          >
            Open & save your keepsake
          </button>
        )}
        {p.bag.length === 0 ? (
          <p className="text-sm text-ink-2">Nothing yet.</p>
        ) : (
          <ul className="mt-1 flex flex-wrap gap-2">
            {p.bag.map((x) => (
              <li key={x.item.uid ?? x.item.id}>
                {x.keepsake ? (
                  <button
                    type="button"
                    className="rounded-full border border-seal px-3 py-1 text-sm"
                    onClick={() => setOpen(x.keepsake!)}
                  >
                    {x.item.icon} {x.item.name} (open)
                  </button>
                ) : (
                  <span className="rounded-full border border-line px-3 py-1 text-sm">
                    {x.item.icon} {x.item.name}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      {open && (
        <div className="grid gap-3 rounded-md border border-line p-3">
          <Keepsake
            data={open}
            network={getChain(p.chain).chain.name}
            statusUrl={`${origin}/c/${p.chain}/${open.certificateId}`}
          />
          <button type="button" className={buttonClass('secondary')} onClick={() => setOpen(null)}>
            Close
          </button>
        </div>
      )}
    </div>
  )
}

// ── the till, when the visitor pays from a phone ─────────────────────────────
function OrderView(p: {
  order: Order
  onPhone: boolean
  mode: ReturnType<typeof useCarryMode>[0]
  setMode: ReturnType<typeof useCarryMode>[1]
  till: Till
  chain: ChainKey
  onPaidByPhone: (r: CounterResult, noteQr: string) => void
  onDone: () => void
}) {
  const [result, setResult] = useState<CounterResult | null>(null)
  const [receipt, setReceipt] = useState<string | null>(null)
  const busy = useRef(false)
  const take = async (text: string) => {
    if (busy.current || (result && result.status !== 'REJECTED') || !/^(https?:|fm[12])/.test(text)) return
    busy.current = true
    try {
      const fm1 = slipForOrder(text, p.order.id)
      const r = await p.till.counter.accept(fm1, p.order.price, p.order.id)
      setResult(r)
      if (r.status !== 'REJECTED' && r.requestId && r.certificateId) {
        setReceipt(
          encodeReceipt({
            memo: r.requestId,
            certificate: r.certificateId,
            price: p.order.price,
            status: r.status,
            item: p.order.items.map((i) => i.name).join(', ') || 'A tip for Mei',
          }),
        )
        p.onPaidByPhone(r, fm1)
      }
    } finally {
      busy.current = false
    }
  }
  return (
    <div className="grid gap-3">
      <p className="font-display text-xl font-semibold">
        {p.order.role === 'tips' ? 'Tip for Mei' : p.order.items.map((i) => i.icon).join(' ')} · {usdc(p.order.price)}
      </p>
      {!p.onPhone ? (
        <p className="text-sm text-ink-2">Waiting for the visitor to pay, in their wallet.</p>
      ) : (
        <>
          <ModePicker mode={p.mode} onChange={p.setMode} />
          <CarryLink
            mode={p.mode}
            send={receipt ?? carriedPrice(p.order.qr)}
            sendLabel={receipt ? 'Receipt for the phone' : `Price code for ${usdc(p.order.price)}`}
            onText={(t) => void take(t)}
          />
          {result && (
            <p className={`font-medium ${result.status === 'REJECTED' ? 'text-seal' : ''}`} role="status">
              {result.status === 'GUARANTEED'
                ? '✓ Accepted and guaranteed, no internet needed.'
                : result.status === 'UNVERIFIED'
                  ? 'Accepted at the till’s own risk.'
                  : `Refused: ${result.reason}.`}
            </p>
          )}
        </>
      )}
      <button type="button" className="text-sm text-indigo underline sm:w-fit" onClick={p.onDone}>
        {result && result.status !== 'REJECTED' ? 'Next customer' : 'Cancel this order'}
      </button>
    </div>
  )
}

// ── the books ─────────────────────────────────────────────────────────────────
function Books({
  tills,
  chain,
  cut,
  version,
  onCollected,
}: {
  tills: Array<{ name: string; till: Till }>
  chain: ChainKey
  cut: boolean
  version: number
  onCollected: (at: number) => void
}) {
  const [rows, setRows] = useState<Array<{ seller: string; accepted: bigint; collected: bigint }>>([])
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; href?: string } | null>(null)
  const chainId = getChain(chain).chain.id
  const load = useCallback(() => {
    setRows(
      tills.map(({ name, till }) => {
        const certs = till.store.snapshot().certs.filter(([key]) => key.startsWith(`${chainId}:`))
        return {
          seller: name,
          accepted: certs.reduce((s, [, r]) => s + BigInt(r.consumed), 0n),
          collected: certs.reduce((s, [, r]) => s + BigInt(r.redeemed), 0n),
        }
      }),
    )
  }, [tills, chainId])
  // biome-ignore lint/correctness/useExhaustiveDependencies: refresh after each payment (version)
  useEffect(load, [load, version])

  async function collect() {
    const collectedAt = Date.now()
    setBusy(true)
    setMsg(null)
    try {
      for (const { till } of tills) await till.counter.reconcile().catch(() => {})
      const pending = []
      for (const { till } of tills)
        for (const pr of await till.store.pendingRedemptions(chainId)) pending.push({ till, pr })
      if (pending.length === 0) {
        setMsg({ text: 'Nothing new to collect: everything accepted is already collected.' })
        return
      }
      const res = await fetch('/api/demo/counter/collect', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ chain, notes: pending.map(({ pr }) => encodeHeader(pr.note)) }),
      })
      const body = (await res.json()) as { tx?: string; hash?: Hex; collected?: number; error?: string; note?: string }
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      let waiting = 0
      for (const { till } of tills) waiting += (await till.syncCollected(body.hash)).waiting
      if (waiting > 0)
        throw new Error(
          'Collection was submitted, but some amounts still need a network check. They remain pending; reconnect to check again.',
        )
      let remaining = 0
      for (const { till } of tills) remaining += (await till.store.pendingRedemptions(chainId)).length
      if (remaining === 0) onCollected(collectedAt)
      setMsg(
        body.tx
          ? {
              text: `Collection checked for ${rows
                .filter((r) => r.accepted > r.collected)
                .map((r) => r.seller)
                .join(' and ')}. Any unpaid amounts remain pending. No gas paid by the visitor.`,
              href: body.tx,
            }
          : { text: body.note ?? 'Done.' },
      )
    } catch (e) {
      setMsg({ text: (e as Error).message })
    } finally {
      setBusy(false)
      load()
    }
  }

  const ready = rows.reduce((s, r) => s + (r.accepted > r.collected ? r.accepted - r.collected : 0n), 0n)
  return (
    <section className="sheet grid gap-3 p-5" aria-labelledby="books-t">
      <h2 id="books-t" className="font-display text-2xl font-semibold">
        Seller collection
      </h2>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="text-ink-2">
            <th className="py-1 font-normal">Seller</th>
            <th className="py-1 font-normal">Accepted</th>
            <th className="py-1 font-normal">Collected</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.seller} className="border-t border-line">
              <td className="py-1.5">{r.seller}</td>
              <td className="py-1.5 font-mono lining-nums">{usdc(r.accepted)}</td>
              <td className="py-1.5 font-mono lining-nums">
                {usdc(r.collected)}
                {r.accepted > 0n && r.collected >= r.accepted ? ' ✓' : ''}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-sm text-ink-2">
        Until collected, the money waits in each budget, set aside for its seller. Collecting sends everything ready (
        {usdc(ready)} test USDC) to the sellers in one transaction. Funding and collection need network fees; the demo
        covers them.
      </p>
      <button
        type="button"
        className={`${buttonClass('primary')} sm:w-fit`}
        onClick={() => void collect()}
        disabled={busy || cut || ready === 0n}
      >
        {cut
          ? 'Reconnect the till to collect'
          : busy
            ? 'Collecting…'
            : ready === 0n
              ? 'Everything collected'
              : `Collect ${usdc(ready)} USDC`}
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
    </section>
  )
}
