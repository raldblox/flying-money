'use client'
import { type ReactNode, useEffect, useId, useState } from 'react'
import { CarryReceive, CarrySend } from '@/components/carry/carry'
import { FaceToFace } from '@/components/carry/face-to-face'
import { SoundLink } from '@/components/carry/sound-link'

/**
 * Every way a payment can travel between a phone and a till, each with its own flow. Whatever the carrier, the same
 * few hundred bytes cross (a price code, a slip, a receipt), and the till checks the slip the same way: with no
 * internet, if it has seen the budget before.
 */
export type CarryMode = 'face' | 'qr' | 'sound' | 'ultrasound' | 'manual'

export const CARRY_MODES: Record<CarryMode, { name: string; hint: string }> = {
  face: {
    name: 'Face to face',
    hint: 'Hold the screens facing each other. Each shows a code and reads the other’s; everything crosses by itself.',
  },
  qr: {
    name: 'QR code',
    hint: 'With the back camera: point it at the other screen to read, turn your screen to it to show yours.',
  },
  sound: {
    name: 'Sound',
    hint: 'Short chirps both ways, repeated until answered. Hold the devices close in a quiet room.',
  },
  ultrasound: {
    name: 'Ultrasound',
    hint: 'The same chirps above what most people hear: for machines, and devices close together.',
  },
  manual: {
    name: 'Link · share · file · text',
    hint: 'By hand: AirDrop, Quick Share, a message, a file, or copy and paste.',
  },
}

const KEY = 'fm-carry-mode'

/** The carrier this device used last (the two devices must pick the same one). */
export function useCarryMode(): [CarryMode, (m: CarryMode) => void] {
  const [mode, setMode] = useState<CarryMode>('face')
  useEffect(() => {
    try {
      const m = localStorage.getItem(KEY) as CarryMode | null
      if (m && m in CARRY_MODES) setMode(m)
    } catch {
      // private mode: start with face to face each time
    }
  }, [])
  return [
    mode,
    (m) => {
      setMode(m)
      try {
        localStorage.setItem(KEY, m)
      } catch {
        // not remembered, still used
      }
    },
  ]
}

export function ModePicker({ mode, onChange }: { mode: CarryMode; onChange: (m: CarryMode) => void }) {
  const name = useId()
  return (
    <fieldset className="min-w-0">
      <legend className="smallcaps mb-1.5 text-xs text-ink-2">How it travels (choose the same on both devices)</legend>
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(CARRY_MODES) as CarryMode[]).map((k) => (
          <label key={k} className="relative block cursor-pointer">
            <input
              type="radio"
              name={name}
              value={k}
              checked={mode === k}
              onChange={() => onChange(k)}
              className="peer sr-only"
            />
            <span
              className={`flex min-h-10 items-center rounded-full border px-3.5 text-sm font-medium transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-indigo ${
                mode === k ? 'border-ink bg-ink text-paper' : 'border-line bg-paper text-ink hover:border-ink/50'
              }`}
            >
              {CARRY_MODES[k].name}
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-sm text-ink-2">{CARRY_MODES[mode].hint}</p>
    </fieldset>
  )
}

/** The chosen carrier, sending `send` (if any) and reporting everything it receives. */
export function CarryLink({
  mode,
  send,
  sendLabel,
  onText,
  waiting,
}: {
  mode: CarryMode
  send: string | null
  sendLabel: string
  onText: (text: string) => void
  waiting?: ReactNode
}) {
  if (mode === 'face' || mode === 'qr')
    return (
      <FaceToFace
        key={mode}
        facing={mode === 'face' ? 'user' : 'environment'}
        show={send}
        showLabel={sendLabel}
        onText={onText}
        waiting={waiting}
      />
    )
  if (mode === 'sound' || mode === 'ultrasound')
    return (
      <SoundLink
        key={mode}
        band={mode === 'sound' ? 'audible' : 'ultrasound'}
        send={send}
        sendLabel={sendLabel}
        onText={onText}
        waiting={waiting}
      />
    )
  return (
    <div className="grid gap-4" data-carry={send ?? ''}>
      {send ? (
        <CarrySend
          payload={send}
          title={sendLabel}
          carriers={['share', 'link', 'file', 'text', 'qr']}
          fileName="flying-money.txt"
        />
      ) : (
        <p className="text-sm text-ink-2">{waiting}</p>
      )}
      <div className="border-t border-line pt-3">
        <p className="smallcaps mb-2 text-xs text-ink-2">What the other device sends back</p>
        <CarryReceive
          prompt="Point the camera at the other screen’s code."
          carriers={['paste', 'file', 'camera']}
          onText={onText}
        />
      </div>
    </div>
  )
}
