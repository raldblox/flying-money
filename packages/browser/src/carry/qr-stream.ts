'use client'
import jsQRModule from 'jsqr'

const jsQR = jsQRModule as unknown as (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options: { inversionAttempts: string },
) => { data: string } | null

interface Detector {
  detect(source: HTMLVideoElement): Promise<Array<{ rawValue: string }>>
}

/**
 * Reads QR codes from a camera continuously (face to face: it never stops after one read), about ten times a second.
 * The same text is reported once, until something different has been read. Frames are decoded on the device.
 */
export async function startQrStream(
  video: HTMLVideoElement,
  opts: { facingMode: 'user' | 'environment'; onText: (text: string) => void },
): Promise<() => void> {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: opts.facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  })
  video.srcObject = stream
  video.muted = true
  video.playsInline = true
  await video.play()
  const Det = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
  const detector = Det ? new Det({ formats: ['qr_code'] }) : null
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!
  let last = ''
  let running = true
  let timer: ReturnType<typeof setTimeout> | undefined
  const tick = async () => {
    if (!running) return
    let text: string | null = null
    if (video.readyState >= 2) {
      if (detector) text = (await detector.detect(video).catch(() => []))[0]?.rawValue ?? null
      else {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        ctx.drawImage(video, 0, 0)
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
        text = jsQR(img.data, img.width, img.height, { inversionAttempts: 'attemptBoth' })?.data ?? null
      }
    }
    if (text && text !== last) {
      last = text
      opts.onText(text)
    }
    timer = setTimeout(() => void tick(), 100)
  }
  void tick()
  return () => {
    running = false
    if (timer) clearTimeout(timer)
    for (const t of stream.getTracks()) t.stop()
    video.srcObject = null
  }
}
