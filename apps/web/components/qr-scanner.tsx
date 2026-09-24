'use client'
import jsQR from 'jsqr'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { buttonClass } from './section'

interface Detector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector
  }
}

/**
 * Scans a QR with the camera (BarcodeDetector where available, jsQR otherwise), or accepts pasted text.
 * Nothing leaves the device: frames are decoded locally and never uploaded.
 */
export function QrScanner({
  onResult,
  prompt,
  pasteLabel = 'Or paste the code',
}: {
  onResult: (text: string) => void
  prompt: string
  pasteLabel?: string
}) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const raf = useRef<number>(0)
  const [on, setOn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pasted, setPasted] = useState('')
  const id = useId()

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    for (const t of stream.current?.getTracks() ?? []) t.stop()
    stream.current = null
    setOn(false)
  }, [])
  useEffect(() => stop, [stop])

  async function start() {
    setError(null)
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      stream.current = s
      setOn(true)
      const v = video.current!
      v.srcObject = s
      await v.play()
      const detector = window.BarcodeDetector ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!
      const tick = async () => {
        if (!stream.current) return
        let text: string | null = null
        if (v.readyState >= 2) {
          if (detector) {
            const found = await detector.detect(v).catch(() => [])
            text = found[0]?.rawValue ?? null
          } else {
            canvas.width = v.videoWidth
            canvas.height = v.videoHeight
            ctx.drawImage(v, 0, 0)
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
            text = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null
          }
        }
        if (text) {
          stop()
          onResult(text)
          return
        }
        raf.current = requestAnimationFrame(() => void tick())
      }
      void tick()
    } catch (e) {
      stop()
      setError(
        (e as Error).name === 'NotAllowedError'
          ? 'Camera permission was denied. Allow it in the browser, or paste the code below.'
          : 'No camera available here. Paste the code below instead.',
      )
    }
  }

  return (
    <div className="grid gap-4">
      <div className="relative aspect-square w-full overflow-hidden rounded-md border border-line bg-paper-2">
        <video ref={video} muted playsInline className={`size-full object-cover ${on ? '' : 'hidden'}`} />
        {!on && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center">
            <div>
              <p className="text-ink-2">{prompt}</p>
              <button type="button" className={`${buttonClass('primary')} mt-4`} onClick={() => void start()}>
                Open camera
              </button>
            </div>
          </div>
        )}
        {on && (
          <>
            <span aria-hidden className="pointer-events-none absolute inset-[18%] rounded-md border-2 border-seal/80" />
            <button
              type="button"
              onClick={stop}
              className="absolute bottom-3 right-3 min-h-10 rounded bg-paper/90 px-3 text-sm font-medium"
            >
              Stop camera
            </button>
          </>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-seal">
          {error}
        </p>
      )}
      <form
        className="grid gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (pasted.trim()) onResult(pasted.trim())
        }}
      >
        <label htmlFor={id} className="text-sm font-medium">
          {pasteLabel}
        </label>
        <div className="flex gap-2">
          <input
            id={id}
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="fm1.…"
            autoComplete="off"
            spellCheck={false}
            className="min-h-11 w-full min-w-0 flex-1 rounded border border-line bg-paper px-3 font-mono text-sm"
          />
          <button type="submit" className={buttonClass('secondary')} disabled={!pasted.trim()}>
            Use
          </button>
        </div>
      </form>
    </div>
  )
}
