'use client'
import { buttonClass } from '@/components/section'

export type Access = 'granted' | 'denied' | 'prompt'

/** What the browser will say if we ask now. Browsers that can't tell (some Safari versions) count as "prompt". */
export async function accessState(kind: 'camera' | 'microphone'): Promise<Access> {
  try {
    const s = await navigator.permissions.query({ name: kind as PermissionName })
    return s.state as Access
  } catch {
    return 'prompt'
  }
}

const WHY = {
  camera: {
    title: 'Turn on the camera',
    why: 'To read the code on the other screen. That’s how the price, your payment and the receipt travel, with no internet needed.',
    privacy: 'Frames are read on this device and never uploaded or saved.',
    blocked:
      'This browser blocked the camera for this site. Allow it in the site settings (the icon left of the address), then try again. Or pick another way to pay above.',
  },
  microphone: {
    title: 'Turn on the microphone',
    why: 'To hear the other device’s chirps. That’s how the price, your payment and the receipt travel by sound, with no internet needed.',
    privacy: 'Sound is decoded on this device. Nothing is recorded, saved or sent.',
    blocked:
      'This browser blocked the microphone for this site. Allow it in the site settings (the icon left of the address), then try again. Or pick another way to pay above.',
  },
} as const

/**
 * Asks before the browser does: what we need, why, and what stays on the device. The browser's own prompt appears
 * only after the person chooses to turn it on.
 */
export function AskAccess({
  kind,
  state,
  onAllow,
}: {
  kind: 'camera' | 'microphone'
  state: Access
  onAllow: () => void
}) {
  const t = WHY[kind]
  return (
    <section className="grid gap-2 rounded-md border border-line bg-paper p-4 text-left" aria-label={t.title}>
      <p className="font-medium">{t.title}</p>
      <p className="text-sm text-ink-2">{t.why}</p>
      <p className="text-xs text-ink-2">{t.privacy}</p>
      {state === 'denied' ? (
        <p role="alert" className="text-sm text-seal">
          {t.blocked}
        </p>
      ) : (
        <p className="text-xs text-ink-2">Your browser will ask for permission next.</p>
      )}
      <button type="button" className={`${buttonClass('primary')} sm:w-fit`} onClick={onAllow}>
        {state === 'denied' ? 'Try again' : t.title}
      </button>
    </section>
  )
}
