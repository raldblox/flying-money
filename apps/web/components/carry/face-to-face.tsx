'use client'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { type Access, AskAccess, accessState } from '@/components/carry/ask-access'
import { QrCode } from '@/components/qr'
import { startQrStream } from '@/lib/carry/qr-stream'

/**
 * Camera carriers. Face to face (`facing="user"`): hold the two devices screen to screen; each shows a QR code and
 * reads the other's with the camera on its screen side (a phone's front camera, a laptop's webcam), at the same time.
 * QR (`facing="environment"`): the phone's back camera reads the other screen when pointed at it, and the phone's
 * own code shows when it's turned around. Either way, no network, no pairing, no buttons: whatever one side shows
 * next, the other reads.
 */
export function FaceToFace({
  show,
  showLabel,
  onText,
  facing = 'user',
  waiting,
  className = '',
}: {
  /** what this device shows now (null: nothing yet) */
  show: string | null
  showLabel: string
  /** every new code read from the other screen */
  onText: (text: string) => void
  facing?: 'user' | 'environment'
  /** shown in place of the QR while there's nothing to show */
  waiting?: ReactNode
  className?: string
}) {
  const video = useRef<HTMLVideoElement>(null)
  const stopRef = useRef<(() => void) | null>(null)
  const onTextRef = useRef(onText)
  onTextRef.current = onText
  const [state, setState] = useState<'checking' | 'ask' | 'starting' | 'reading'>('checking')
  const [access, setAccess] = useState<Access>('prompt')
  const [blink, setBlink] = useState(0)

  const start = useCallback(async () => {
    stopRef.current?.()
    setState('starting')
    try {
      stopRef.current = await startQrStream(video.current!, {
        facingMode: facing,
        onText: (t) => {
          setBlink((n) => n + 1)
          onTextRef.current(t)
        },
      })
      setState('reading')
    } catch {
      setAccess(await accessState('camera'))
      setState('ask')
    }
  }, [facing])

  // explain before the browser asks: start by itself only when the camera is already allowed for this site
  useEffect(() => {
    let gone = false
    void accessState('camera').then((a) => {
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

  // what a camera would read can also arrive as an event: tests drive both sides this way, and so can a page that
  // gets the code by other means (the same-origin page could call onText anyway)
  useEffect(() => {
    const on = (e: Event) => {
      const t = (e as CustomEvent<string>).detail
      if (typeof t === 'string') onTextRef.current(t)
    }
    window.addEventListener('fm:carry', on)
    return () => window.removeEventListener('fm:carry', on)
  }, [])

  return (
    <div className={`grid gap-3 ${className}`} data-carry={show ?? ''}>
      <div className="mx-auto w-full max-w-[min(88vw,26rem)] rounded-md bg-[#fbf7ef] p-2">
        {show ? (
          <QrCode value={show} label={showLabel} />
        ) : (
          <div className="grid aspect-square place-items-center p-6 text-center text-[#5d554a]">{waiting}</div>
        )}
      </div>
      {state === 'ask' && <AskAccess kind="camera" state={access} onAllow={() => void start()} />}
      {/* one video element for the whole life of the component: the camera attaches to it before it's shown */}
      <div className={`flex items-center justify-center gap-3 ${state === 'ask' ? 'hidden' : ''}`}>
        <div className="relative size-16 shrink-0 overflow-hidden rounded-full border-2 border-seal/70 bg-paper-2">
          <video
            ref={video}
            muted
            playsInline
            aria-hidden
            className={`size-full object-cover ${facing === 'user' ? '-scale-x-100' : ''}`}
          />
          {blink > 0 && (
            <span key={blink} aria-hidden className="absolute inset-0 animate-ping rounded-full bg-celadon/40" />
          )}
        </div>
        <p className="text-sm text-ink-2" role="status">
          {state === 'reading'
            ? facing === 'user'
              ? 'Reading the other screen. Hold the devices face to face.'
              : 'Point the back camera at the other screen to read it; turn this screen to it to show yours.'
            : 'Starting the camera…'}
        </p>
      </div>
    </div>
  )
}
