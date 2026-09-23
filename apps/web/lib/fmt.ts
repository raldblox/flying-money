import { formatUnits } from 'viem'

/** USDC base units (6 dp) → "0.25". Amounts are bigint everywhere; this is display only. */
export function usdc(v: bigint | string, opts: { min?: number } = {}): string {
  const s = formatUnits(typeof v === 'string' ? BigInt(v) : v, 6)
  const [i = '0', f = ''] = s.split('.')
  const frac = f.replace(/0+$/, '').padEnd(opts.min ?? 2, '0')
  const whole = BigInt(i.replace('-', '')).toLocaleString('en-US')
  return `${i.startsWith('-') ? '-' : ''}${whole}${frac ? `.${frac}` : ''}`
}

export const short = (hex: string, head = 6, tail = 4) =>
  hex.length > head + tail + 2 ? `${hex.slice(0, head)}…${hex.slice(-tail)}` : hex

export function relTime(unixSeconds: bigint | number, now = Date.now() / 1000): string {
  const d = Number(unixSeconds) - now
  const abs = Math.abs(d)
  const [n, unit] =
    abs >= 86_400
      ? [Math.round(abs / 86_400), 'day']
      : abs >= 3_600
        ? [Math.round(abs / 3_600), 'hour']
        : [Math.max(1, Math.round(abs / 60)), 'minute']
  const label = `${n} ${unit}${n === 1 ? '' : 's'}`
  return d >= 0 ? `in ${label}` : `${label} ago`
}

export const utcDate = (unixSeconds: bigint | number) =>
  `${new Date(Number(unixSeconds) * 1000).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC`
