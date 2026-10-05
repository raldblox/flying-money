'use client'
import { type ChainKey, getChain, rpcUrl } from '@flying-money/chains'
import { encodeHeader, type Hex, readCertificate } from '@flying-money/core'
import type { CounterResult } from '@flying-money/server/browser'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPublicClient, http } from 'viem'
import { CarryReceive, CarrySend } from '@/components/carry/carry'
import { Keepsake, type KeepsakeData } from '@/components/carry/keepsake'
import { NetworkPicker, type PickerNetwork } from '@/components/network-picker'
import { buttonClass } from '@/components/section'
import { listenForCarried } from '@/lib/carry/channel'
import { PROVERBS } from '@/lib/carry/proverbs'
import { carriedPrice, slipForOrder } from '@/lib/carry/till'
import { short } from '@/lib/fmt'
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
      // the till checks the budget now, while online: that is what lets it accept it later with no connection
      await till.counter.server.certificate(getChain(chain).chain.id, body.certificateId, true)
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

      {till && funded && <Sell till={till} chain={chain} />}
      {till && funded && <Collect till={till} chain={chain} offline={isOffline} />}
    </div>
  )
}

function Sell({ till, chain }: { till: Till; chain: ChainKey }) {
  const [order, setOrder] = useState<Order | null>(null)
  const [name, setName] = useState('')
  const [result, setResult] = useState<CounterResult | null>(null)
  const [keepsake, setKeepsake] = useState<KeepsakeData | null>(null)
  const ids = useId()

  const take = useCallback(
    async (text: string) => {
      if (!order) return
      const r = await till.counter.accept(slipForOrder(text, order.id), PRICE, order.id)
      setResult(r)
      if (r.status !== 'REJECTED' && r.requestId && r.certificateId)
        setKeepsake({
          serial: r.requestId.slice(-8).toUpperCase(),
          name: name.trim(),
          issuedAt: new Date().toISOString(),
          paid: PRICE.toString(),
          chainId: getChain(chain).chain.id,
          certificateId: r.certificateId,
          proverb: PROVERBS[Number.parseInt(r.requestId.slice(-4), 16) % PROVERBS.length]!,
        })
    },
    [order, till, name, chain],
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
            setResult(null)
            setKeepsake(null)
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
      ) : keepsake && result ? (
        <div className="grid gap-4">
          <p className="font-display text-xl font-semibold" role="status">
            {result.status === 'GUARANTEED'
              ? '✓ Accepted and guaranteed: checked on the spot, no internet needed.'
              : 'Accepted at the shop’s own risk (this till had never checked that budget).'}
          </p>
          <Keepsake
            data={keepsake}
            network={getChain(chain).chain.name}
            statusUrl={`${window.location.origin}/c/${chain}/${keepsake.certificateId}`}
          />
          <button type="button" className={`${buttonClass('secondary')} sm:w-fit`} onClick={() => setOrder(null)}>
            Sell another
          </button>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="grid gap-2">
            <p className="smallcaps text-sm text-ink-2">Send the price to the phone</p>
            <CarrySend
              payload={carriedPrice(order.qr)}
              title="Price code for 0.01 USDC"
              carriers={['qr', 'sound', 'link', 'text']}
            />
          </div>
          <div className="grid gap-2">
            <p className="smallcaps text-sm text-ink-2">Then receive the phone’s slip</p>
            <CarryReceive
              prompt="Point the camera at the slip on the phone."
              carriers={['camera', 'sound', 'paste']}
              onText={(t) => void take(t)}
            />
            {result?.status === 'REJECTED' && (
              <p role="alert" className="text-sm text-seal">
                Refused: {result.reason}.
              </p>
            )}
            <button type="button" className="text-sm text-indigo underline sm:w-fit" onClick={() => setOrder(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </section>
  )
}

function Collect({ till, chain, offline }: { till: Till; chain: ChainKey; offline: boolean }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; href?: string } | null>(null)
  const ids = useId()
  async function collect() {
    setBusy(true)
    setMsg(null)
    try {
      const pending = await till.store.pendingRedemptions(getChain(chain).chain.id)
      if (pending.length === 0) return setMsg({ text: 'Nothing to collect yet. Sell something first.' })
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
          ? { text: `Collected ${body.collected} in one transaction.`, href: body.tx }
          : { text: body.note ?? 'Done.' },
      )
    } catch (e) {
      setMsg({ text: (e as Error).message })
    } finally {
      setBusy(false)
    }
  }
  return (
    <section className="sheet grid gap-3 p-5" aria-labelledby={`${ids}-4`}>
      <h2 id={`${ids}-4`} className="font-display text-2xl font-semibold">
        4 · Back online: collect
      </h2>
      <p className="text-sm text-ink-2">
        The till sends what it accepted to the network in one transaction. Until then, the money waits in the budget,
        set aside for this till.
      </p>
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
    </section>
  )
}
