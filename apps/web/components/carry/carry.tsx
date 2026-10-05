'use client'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { QrCode } from '@/components/qr'
import { QrScanner } from '@/components/qr-scanner'
import { buttonClass } from '@/components/section'
import { carryLink } from '@/lib/carry/codec'

/**
 * Carriers: the ways a payment slip or price code moves between devices. All of them carry the same few hundred
 * bytes of signed data; none needs the internet except sharing to an app that does.
 */
export type SendCarrier = 'qr' | 'sound' | 'share' | 'link' | 'file' | 'text'
export type ReceiveCarrier = 'camera' | 'sound' | 'file' | 'paste'

const SEND: Record<SendCarrier, { name: string; hint: string }> = {
  qr: { name: 'QR code', hint: 'Scan it with the other device’s camera. Works offline.' },
  sound: {
    name: 'Sound',
    hint: 'Plays as short chirps; the other device listens. Works offline. Choose Listen there first.',
  },
  share: {
    name: 'Share',
    hint: 'Your phone’s share menu: AirDrop and Quick Share work device to device without internet.',
  },
  link: { name: 'Link', hint: 'Opens this payment in Flying Money on any device.' },
  file: { name: 'File', hint: 'Save it, move it any way you like (USB, AirDrop, a memory card), open it there.' },
  text: { name: 'Text', hint: 'Copy the code and paste it on the other device.' },
}
const RECEIVE: Record<ReceiveCarrier, { name: string; hint: string }> = {
  camera: { name: 'Camera', hint: 'Scan the QR code on the other screen.' },
  sound: { name: 'Listen', hint: 'Hold the devices close, then press Play on the other one.' },
  file: { name: 'File', hint: 'Open a saved Flying Money file.' },
  paste: { name: 'Paste', hint: 'Paste a copied code or link.' },
}

function Chips<T extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string
  items: Array<[T, string]>
  value: T
  onChange: (v: T) => void
}) {
  const name = useId()
  return (
    <fieldset className="min-w-0">
      <legend className="smallcaps mb-1.5 text-xs text-ink-2">{label}</legend>
      <div className="flex flex-wrap gap-1.5">
        {items.map(([k, n]) => (
          <label key={k} className="relative block cursor-pointer">
            <input
              type="radio"
              name={name}
              value={k}
              checked={value === k}
              onChange={() => onChange(k)}
              className="peer sr-only"
            />
            <span
              className={`flex min-h-10 items-center rounded-full border px-3.5 text-sm font-medium transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo ${
                value === k ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink hover:border-ink/50'
              }`}
            >
              {n}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  )
}

async function copy(text: string) {
  await navigator.clipboard.writeText(text)
}

function saveFile(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** Sends a payload (a slip or price code) by the carrier the person picks. */
export function CarrySend({
  payload,
  title,
  carriers = ['qr', 'sound', 'share', 'link', 'file', 'text'],
  fileName = 'flying-money.txt',
  href,
}: {
  payload: string
  /** a link to send as is (a wallet hand-over), instead of opening the payload through /carry */
  href?: string
  /** what this is, for labels and the share sheet ("Payment slip for 0.01 USDC") */
  title: string
  carriers?: SendCarrier[]
  fileName?: string
}) {
  const [carrier, setCarrier] = useState<SendCarrier>(carriers[0]!)
  const [origin, setOrigin] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => setOrigin(window.location.origin), [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: clear the last message when the carrier or payload changes
  useEffect(() => setStatus(null), [carrier, payload])
  const link = href ?? (origin ? carryLink(origin, payload) : '')
  const canShare = typeof navigator !== 'undefined' && 'share' in navigator

  return (
    <div className="grid gap-3">
      <Chips label="Send it by" items={carriers.map((c) => [c, SEND[c].name])} value={carrier} onChange={setCarrier} />
      <p className="text-sm text-ink-2">{SEND[carrier].hint}</p>
      {carrier === 'qr' && link && (
        <div className="mx-auto w-full max-w-[min(85vw,22rem)]">
          <QrCode value={link} label={`${title}, as a QR code`} />
        </div>
      )}
      {carrier === 'sound' && (
        <button
          type="button"
          className={buttonClass('primary')}
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              const { playText } = await import('@/lib/carry/sound')
              await playText(payload, (i, n) => setStatus(`Playing part ${i} of ${n}…`))
              setStatus('Sent. If the other device didn’t hear it, play it again, a little closer or louder.')
            } catch (e) {
              setStatus(`Couldn’t play sound here: ${(e as Error).message}`)
            } finally {
              setBusy(false)
            }
          }}
        >
          {busy ? 'Playing…' : 'Play'}
        </button>
      )}
      {carrier === 'share' && (
        <button
          type="button"
          className={buttonClass('primary')}
          disabled={!canShare || !link}
          onClick={async () => {
            try {
              await navigator.share({ title, text: title, url: link })
              setStatus('Shared.')
            } catch (e) {
              if ((e as Error).name !== 'AbortError') setStatus((e as Error).message)
            }
          }}
        >
          {canShare ? 'Share…' : 'This browser can’t share; use Link or File'}
        </button>
      )}
      {carrier === 'link' && link && (
        <div className="grid gap-2">
          <p className="break-all rounded border border-line bg-paper-2 p-2 font-mono text-xs">{link}</p>
          <button
            type="button"
            className={buttonClass('secondary')}
            onClick={() => copy(link).then(() => setStatus('Link copied.'))}
          >
            Copy link
          </button>
        </div>
      )}
      {carrier === 'file' && (
        <button
          type="button"
          className={buttonClass('primary')}
          disabled={!link}
          onClick={() => {
            saveFile(fileName, `${link}\n`)
            setStatus(`Saved ${fileName}.`)
          }}
        >
          Save file
        </button>
      )}
      {carrier === 'text' && (
        <div className="grid gap-2">
          <textarea
            readOnly
            value={payload}
            aria-label={`${title}, as text`}
            onFocus={(e) => e.currentTarget.select()}
            className="h-24 w-full rounded border border-line bg-paper p-2 font-mono text-xs"
          />
          <button
            type="button"
            className={buttonClass('secondary')}
            onClick={() => copy(payload).then(() => setStatus('Copied.'))}
          >
            Copy
          </button>
        </div>
      )}
      {status && (
        <p role="status" className="text-sm text-ink-2">
          {status}
        </p>
      )}
    </div>
  )
}

/** Receives a payload by the carrier the person picks. Links, shares and AirDrop open the app directly instead. */
export function CarryReceive({
  onText,
  prompt,
  carriers = ['camera', 'sound', 'file', 'paste'],
}: {
  onText: (text: string, via: ReceiveCarrier) => void
  prompt: string
  carriers?: ReceiveCarrier[]
}) {
  const [carrier, setCarrier] = useState<ReceiveCarrier>(carriers[0]!)
  const [status, setStatus] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [pasted, setPasted] = useState('')
  const stopRef = useRef<(() => void) | null>(null)
  const ids = useId()
  const stopListening = useCallback(() => {
    stopRef.current?.()
    stopRef.current = null
    setListening(false)
  }, [])
  useEffect(() => stopListening, [stopListening])
  useEffect(() => {
    setStatus(null)
    if (carrier !== 'sound') stopListening()
  }, [carrier, stopListening])

  return (
    <div className="grid gap-3">
      <Chips
        label="Receive it by"
        items={carriers.map((c) => [c, RECEIVE[c].name])}
        value={carrier}
        onChange={setCarrier}
      />
      <p className="text-sm text-ink-2">{RECEIVE[carrier].hint}</p>
      {carrier === 'camera' && <QrScanner prompt={prompt} onResult={(t) => onText(t, 'camera')} />}
      {carrier === 'sound' &&
        (listening ? (
          <button type="button" className={buttonClass('secondary')} onClick={stopListening}>
            Stop listening
          </button>
        ) : (
          <button
            type="button"
            className={buttonClass('primary')}
            onClick={async () => {
              setStatus('Listening… press Play on the other device.')
              setListening(true)
              try {
                const { listenForText } = await import('@/lib/carry/sound')
                stopRef.current = await listenForText(
                  (t) => {
                    stopListening()
                    setStatus('Heard it.')
                    onText(t, 'sound')
                  },
                  (got, total) => setStatus(`Heard part ${got} of ${total}…`),
                )
              } catch (e) {
                setListening(false)
                setStatus(
                  (e as Error).name === 'NotAllowedError'
                    ? 'Microphone access was refused. Allow it in the browser to listen.'
                    : `Couldn’t listen here: ${(e as Error).message}`,
                )
              }
            }}
          >
            Listen
          </button>
        ))}
      {carrier === 'file' && (
        <label htmlFor={`${ids}-f`} className={`${buttonClass('primary')} cursor-pointer`}>
          Open a file
          <input
            id={`${ids}-f`}
            type="file"
            accept=".txt,text/plain"
            className="sr-only"
            onChange={async (e) => {
              const f = e.currentTarget.files?.[0]
              if (f) onText(await f.text(), 'file')
            }}
          />
        </label>
      )}
      {carrier === 'paste' && (
        <form
          className="grid gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (pasted.trim()) onText(pasted.trim(), 'paste')
          }}
        >
          <label htmlFor={`${ids}-p`} className="text-sm font-medium">
            Code or link
          </label>
          <textarea
            id={`${ids}-p`}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            spellCheck={false}
            className="h-24 w-full rounded border border-line bg-paper p-2 font-mono text-xs"
          />
          <button type="submit" className={buttonClass('primary')} disabled={!pasted.trim()}>
            Use it
          </button>
        </form>
      )}
      {status && (
        <p role="status" className="text-sm text-ink-2">
          {status}
        </p>
      )}
      <p className="text-xs text-ink-2">Sent as a link, a share or by AirDrop? Just open it on this device.</p>
    </div>
  )
}
