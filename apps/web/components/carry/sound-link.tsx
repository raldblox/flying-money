'use client'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { type Access, AskAccess, accessState } from '@/components/carry/ask-access'
import { FRAME, type SoundBand, toChunks } from '@/lib/carry/sound'

/**
 * Sound as a two-way link, like a walkie-talkie: each device keeps playing what it has to say (the price, the slip,
 * the receipt) every few seconds, and listens in between. When the other side hears it, it answers with its own
 * message, which this side hears in turn. No network, no pairing, no buttons once it's on. Ultrasound is the same,
 * above what most people hear.
 */
export function SoundLink({
  send,
  sendLabel,
  onText,
  band = 'audible',
  waiting,
}: {
  /** what this device says now (null: it only listens) */
  send: string | null
  sendLabel: string
  onText: (text: string) => void
  band?: SoundBand
  waiting?: ReactNode
}) {
  const onTextRef = useRef(onText)
  onTextRef.current = onText
  const sendRef = useRef(send)
  sendRef.current = send
  const playing = useRef(false)
  const stopRef = useRef<(() => void) | null>(null)
  const [state, setState] = useState<'checking' | 'ask' | 'starting' | 'live'>('checking')
  const [access, setAccess] = useState<Access>('prompt')
  const [level, setLevel] = useState(0)
  const [heard, setHeard] = useState<string | null>(null)
  const [part, setPart] = useState<string | null>(null)

  const start = useCallback(async () => {
    stopRef.current?.()
    setState('starting')
    try {
      const { listenForText } = await import('@/lib/carry/sound')
      stopRef.current = await listenForText(
        (t) => {
          if (t === sendRef.current) return
          setHeard('Heard the other device.')
          onTextRef.current(t)
        },
        (got, total) => setHeard(`Hearing part ${got} of ${total}…`),
        (l) => setLevel(l),
        () => playing.current,
      )
      setState('live')
    } catch {
      setAccess(await accessState('microphone'))
      setState('ask')
    }
  }, [])

  // explain before the browser asks: start by itself only when the microphone is already allowed
  useEffect(() => {
    let gone = false
    void accessState('microphone').then((a) => {
      if (gone) return
      setAccess(a)
      if (a === 'granted') void start()
      else setState('ask')
    })
    return () => {
      gone = true
      stopRef.current?.()
    }
  }, [start])

  // keep saying it until the other side answers (the parent then changes `send`); a random gap keeps two talkers
  // from always overlapping
  useEffect(() => {
    if (!send || state !== 'live') return
    let cancelled = false
    void (async () => {
      const { playText } = await import('@/lib/carry/sound')
      while (!cancelled) {
        playing.current = true
        try {
          await playText(send, (i, n) => setPart(`Sending part ${i} of ${n}`), band)
        } catch {
          // a busy audio device: try again next round
        } finally {
          playing.current = false
          setPart(null)
        }
        await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000))
      }
    })()
    return () => {
      cancelled = true
    }
  }, [send, state, band])

  // tests drive both sides with what a microphone would hear, as for the camera
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<string>).detail
      if (typeof t === 'string') onTextRef.current(t)
    }
    window.addEventListener('fm:carry', on)
    return () => window.removeEventListener('fm:carry', on)
  }, [])

  const chirps = send ? toChunks(send).length : 0
  return (
    <div className="grid gap-3" data-carry={send ?? ''}>
      {state === 'ask' ? (
        <AskAccess kind="microphone" state={access} onAllow={() => void start()} />
      ) : (
        <div className="grid gap-3 rounded-md border border-line bg-paper p-4">
          <p className="font-medium" role="status">
            {state !== 'live'
              ? 'Starting the microphone…'
              : send
                ? (part ?? `${sendLabel}: ${chirps} ${chirps === 1 ? 'chirp' : 'chirps'}, repeated until answered`)
                : (waiting ?? 'Listening…')}
          </p>
          <meter min={0} max={1} value={level} aria-label="What the microphone hears" className="h-3 w-full" />
          <p className="text-xs text-ink-2">
            {heard ??
              `Hold the devices close, in a quiet room. Each side plays its message (up to ${FRAME} characters a chirp) and listens in between.`}
          </p>
        </div>
      )}
    </div>
  )
}
