'use client'
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react'
import { QrCode } from '@/components/qr'
import { buttonClass } from '@/components/section'
import { startQrStream } from '@/lib/carry/qr-stream'

/**
 * Face to face: hold the two devices screen to screen. Each shows a QR code and reads the other's with the camera on
 * the same side as its screen (a phone's front camera, a laptop's webcam), at the same time. No network, no pairing,
 * no turns: whatever one side shows next, the other reads.
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
  const [state, setState] = useState<'starting' | 'reading' | 'blocked'>('starting')
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
      setState('blocked')
    }
  }, [facing])

  useEffect(() => {
    void start()
    return () => stopRef.current?.()
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
      <div className="flex items-center justify-center gap-3">
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
            ? 'Reading the other screen. Hold the devices face to face.'
            : state === 'starting'
              ? 'Starting the camera…'
              : 'The camera is off or blocked.'}
        </p>
        {state === 'blocked' && (
          <button type="button" className={buttonClass('secondary')} onClick={() => void start()}>
            Turn on camera
          </button>
        )}
      </div>
    </div>
  )
}
