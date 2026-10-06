/**
 * Sound carrier: a slip or price code plays as short chirps (ggwave, FSK with error correction) and another device
 * listens with its microphone. No network, no pairing. ggwave carries up to 140 text characters a chirp at about 28
 * characters a second, so a payload goes as numbered chunks ("1/2:…"); the listener waits for all of them.
 * The library (≈160 KB with its WebAssembly) loads only when someone picks sound.
 */
import { frameCollector, toFrames } from '@flying-money/core'

type GG = {
  getDefaultParameters(): { sampleRateInp: number; sampleRateOut: number }
  init(p: unknown): number
  encode(i: number, text: string, protocol: number, volume: number): Int8Array
  decode(i: number, data: Int8Array): Int8Array | null
  free?(i: number): void
  disableLog(): void
  ProtocolId: Record<string, number>
}

let loaded: Promise<GG> | null = null
function lib(): Promise<GG> {
  loaded ??= import('ggwave').then(async (m) => {
    const factory = ((m as { default?: unknown }).default ?? m) as () => Promise<GG>
    const g = await factory()
    g.disableLog()
    return g
  })
  return loaded
}

/** ggwave carries up to 140 characters a chirp: each chirp is one frame (core's toFrames, "i/n:part"). */
export const FRAME = 140
export const toChunks = (text: string) => toFrames(text, FRAME)
export const chunkCollector = frameCollector

/**
 * Audible chirps for people in the room; ultrasound (above about 15 kHz, hard to hear for most adults) for machines.
 * The listener hears either: ggwave recognises the protocol by itself.
 */
export type SoundBand = 'audible' | 'ultrasound'
const PROTOCOL: Record<SoundBand, string> = {
  audible: 'GGWAVE_PROTOCOL_AUDIBLE_FASTEST',
  ultrasound: 'GGWAVE_PROTOCOL_ULTRASOUND_FASTEST',
}

/** Plays the text as chirps. Resolves when the last chunk has played. */
export async function playText(
  text: string,
  onChunk?: (i: number, n: number) => void,
  band: SoundBand = 'audible',
): Promise<void> {
  const g = await lib()
  const ctx = new AudioContext()
  try {
    const p = g.getDefaultParameters()
    p.sampleRateOut = ctx.sampleRate
    const inst = g.init(p)
    const chunks = toChunks(text)
    for (const [i, c] of chunks.entries()) {
      onChunk?.(i + 1, chunks.length)
      const w = g.encode(inst, c, g.ProtocolId[PROTOCOL[band]]!, 25)
      const samples = new Float32Array(w.buffer, w.byteOffset, w.byteLength / 4)
      const buf = ctx.createBuffer(1, samples.length, ctx.sampleRate)
      buf.copyToChannel(new Float32Array(samples), 0)
      const src = ctx.createBufferSource()
      src.buffer = buf
      src.connect(ctx.destination)
      await new Promise<void>((done) => {
        src.onended = () => done()
        src.start()
      })
      await new Promise((r) => setTimeout(r, 350))
    }
    g.free?.(inst)
  } finally {
    await ctx.close().catch(() => {})
  }
}

/**
 * Listens on the microphone until a whole payload arrives (or `stop()` is called). Echo cancellation and noise
 * suppression are off: they would treat the chirps as noise.
 */
export async function listenForText(
  onText: (text: string) => void,
  onProgress?: (got: number, total: number) => void,
): Promise<() => void> {
  const g = await lib()
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  })
  const ctx = new AudioContext()
  const p = g.getDefaultParameters()
  p.sampleRateInp = ctx.sampleRate
  const inst = g.init(p)
  const collect = chunkCollector()
  const source = ctx.createMediaStreamSource(stream)
  // ScriptProcessor is deprecated but works in every browser that has a microphone; an AudioWorklet would need its
  // own module file and the library inside it
  const proc = ctx.createScriptProcessor(1024, 1, 1)
  proc.onaudioprocess = (e) => {
    const frame = new Float32Array(e.inputBuffer.getChannelData(0))
    const r = g.decode(inst, new Int8Array(frame.buffer))
    if (!r || r.byteLength === 0) return
    const got = collect(new TextDecoder().decode(new Uint8Array(r.buffer, r.byteOffset, r.byteLength)))
    if (!got) return
    onProgress?.(got.got, got.total)
    if (got.text) onText(got.text)
  }
  source.connect(proc)
  proc.connect(ctx.destination)
  return () => {
    proc.disconnect()
    source.disconnect()
    for (const t of stream.getTracks()) t.stop()
    void ctx.close().catch(() => {})
    g.free?.(inst)
  }
}
