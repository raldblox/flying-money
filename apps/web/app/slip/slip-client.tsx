'use client'
import { getChainById } from '@flying-money/chains'
import { encodeHeader, NOTE_HEADER, recoverNoteSigner, type SignedNote } from '@flying-money/core'
import { useEffect, useId, useState } from 'react'
import { CarryReceive, CarrySend } from '@/components/carry/carry'
import { Keepsake, type KeepsakeData } from '@/components/carry/keepsake'
import { buttonClass } from '@/components/section'
import { decodeCarried, encodeNoteCompact, payloadOf } from '@/lib/carry/codec'
import { short } from '@/lib/fmt'
import { SITE } from '@/lib/site'

const usd = (n: bigint) => (Number(n) / 1e6).toFixed(2)
const KEPT = 'fm-keepsakes'

function keptFor(certificateId: string): KeepsakeData | null {
  try {
    const all = JSON.parse(localStorage.getItem(KEPT) ?? '{}') as Record<string, KeepsakeData>
    return all[certificateId.toLowerCase()] ?? null
  } catch {
    return null
  }
}
function keep(d: KeepsakeData) {
  try {
    const all = JSON.parse(localStorage.getItem(KEPT) ?? '{}') as Record<string, KeepsakeData>
    all[d.certificateId.toLowerCase()] = d
    localStorage.setItem(KEPT, JSON.stringify(all))
  } catch {
    // private mode: the keepsake still shows, it just isn't remembered
  }
}

/**
 * One slip on this device: decoded and its signature checked locally (no network), then passed on by any carrier or
 * spent at the demo seller for a 飛錢 certificate.
 */
export function SlipClient() {
  const [payload, setPayload] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    const p = payloadOf(window.location.href)
    if (p.startsWith('fm')) setPayload(p)
  }, [])

  let note: SignedNote | null = null
  let decodeError: string | null = null
  if (payload) {
    try {
      const c = decodeCarried(payload)
      if (c.kind !== 'note') throw new Error('That’s a price code, not a payment slip. Open it in your wallet.')
      note = c.note
    } catch (e) {
      decodeError = (e as Error).message
    }
  }

  if (!payload || decodeError || !note)
    return (
      <>
        <h1 className="mt-2 font-display text-4xl font-semibold">Receive a slip</h1>
        <p className="mt-3 text-ink-2">
          A slip is a payment, signed and ready, small enough to travel by camera, sound, a file or a link. Bring one
          here from another device.
        </p>
        {(decodeError || error) && (
          <p role="alert" className="mt-3 text-sm text-seal">
            {decodeError ?? error}
          </p>
        )}
        <div className="sheet mt-6 p-5">
          <CarryReceive
            prompt="Point the camera at the slip’s QR code."
            onText={(t) => {
              setError(null)
              setPayload(payloadOf(t))
              history.replaceState(null, '', `#${payloadOf(t)}`)
            }}
          />
        </div>
      </>
    )
  return <SlipView note={note} payload={payload} />
}

export function SlipView({
  note,
  payload,
  embedded = false,
}: {
  note: SignedNote
  payload: string
  embedded?: boolean
}) {
  const Title = embedded ? 'h2' : 'h1'
  const titleClass = embedded ? 'font-display text-3xl font-semibold' : 'mt-2 font-display text-4xl font-semibold'
  const chain = getChainById(note.chainId)
  const signer = recoverNoteSigner(note)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [kept, setKept] = useState<KeepsakeData | null>(null)
  const [online, setOnline] = useState(true)
  const id = useId()
  useEffect(() => {
    setKept(keptFor(note.certificateId))
    const on = () => setOnline(navigator.onLine)
    on()
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', on)
    }
  }, [note.certificateId])
  const statusUrl = `${window.location.origin}/c/${chain?.key ?? note.chainId}/${note.certificateId}`
  const passOn = encodeNoteCompact(note) ?? payload

  async function spend() {
    setBusy(true)
    setError(null)
    try {
      const url = `${SITE.demoSeller.replace(/\/$/, '')}/v1/certificate?name=${encodeURIComponent(name.trim())}`
      const res = await fetch(url, { headers: { [NOTE_HEADER]: encodeHeader(note) } })
      const body = (await res.json().catch(() => ({}))) as KeepsakeData & { error?: string }
      if (res.ok) {
        keep(body)
        setKept(body)
        return
      }
      const reason = res.headers.get('Flying-Money-Reason')
      setError(
        res.status === 409
          ? 'This slip was already spent, on a different certificate. A slip pays once.'
          : reason === 'unknown-certificate'
            ? 'The seller can’t find this slip’s budget yet. If it was just made, wait a few seconds and try again.'
            : reason === 'wrong-payee'
              ? 'This slip pays a different seller, not the demo shop.'
              : reason === 'insufficient'
                ? 'This slip has already been used up.'
                : (body.error ?? `The seller refused it (${res.status}${reason ? `, ${reason}` : ''}).`),
      )
    } catch {
      setError('You’re offline. The slip is safe on this device: spend it when you’re back online.')
    } finally {
      setBusy(false)
    }
  }

  if (kept)
    return (
      <>
        <Title className={titleClass}>Paid. Here’s your keepsake.</Title>
        <p className="mt-3 text-ink-2">
          The demo seller checked your slip on the spot and served you. It collects the money later, in one transaction
          for many slips; scan the code on the certificate to watch for it.
        </p>
        <div className="mt-6">
          <Keepsake data={kept} network={chain?.chain.name ?? `chain ${note.chainId}`} statusUrl={statusUrl} />
        </div>
      </>
    )

  return (
    <>
      <Title className={titleClass}>{usd(note.cumulative)} USDC, ready to spend</Title>
      <dl className="sheet mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 p-5 text-sm">
        <dt className="text-ink-2">Network</dt>
        <dd>{chain?.chain.name ?? `chain ${note.chainId}`} (test money)</dd>
        <dt className="text-ink-2">Budget</dt>
        <dd className="font-mono">{short(note.certificateId)}</dd>
        <dt className="text-ink-2">Signed by</dt>
        <dd>
          <span className="font-mono">{signer ? short(signer) : 'unknown'}</span>{' '}
          {signer && <span className="text-ink-2">✓ checked on this device, no internet needed</span>}
        </dd>
      </dl>

      <section className="mt-8" aria-labelledby={`${id}-spend`}>
        <h2 id={`${id}-spend`} className="font-display text-2xl font-semibold">
          Spend it
        </h2>
        <p className="mt-2 text-sm text-ink-2">
          The demo seller sells one thing: a personal 飛錢 certificate, drawn from your payment.
        </p>
        <form
          className="mt-3 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault()
            void spend()
          }}
        >
          <label htmlFor={`${id}-n`} className="text-sm font-medium">
            Name on the certificate (optional)
          </label>
          <input
            id={`${id}-n`}
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            className="min-h-11 rounded border border-line bg-paper px-3"
          />
          <button type="submit" className={buttonClass('primary')} disabled={busy || !online}>
            {busy ? 'Paying…' : online ? 'Pay with this slip' : 'Offline: spend it when you’re back online'}
          </button>
        </form>
        {error && (
          <p role="alert" className="mt-3 text-sm text-seal">
            {error}
          </p>
        )}
      </section>

      {!embedded && (
        <section className="mt-10" aria-labelledby={`${id}-pass`}>
          <h2 id={`${id}-pass`} className="font-display text-2xl font-semibold">
            Or pass it on
          </h2>
          <p className="mt-2 text-sm text-ink-2">Send it to another device first, and spend it there.</p>
          <div className="sheet mt-3 p-5">
            <CarrySend
              payload={passOn}
              title={`Payment slip for ${usd(note.cumulative)} USDC`}
              fileName="flying-money-slip.txt"
            />
          </div>
        </section>
      )}
    </>
  )
}
