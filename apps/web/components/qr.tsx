import { encode } from 'uqr'

/**
 * A QR code as crisp SVG. Colours are fixed dark-on-light in both themes on purpose: many scanners cannot read an
 * inverted (light-on-dark) code, so this is the one place that ignores the paper/ink tokens.
 */
export function QrCode({ value, label, className = 'w-full' }: { value: string; label: string; className?: string }) {
  const { data, size } = encode(value, { ecc: 'M', border: 2 })
  let d = ''
  data.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) d += `M${x} ${y}h1v1h-1z`
    })
  })
  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      style={{ background: '#fbf7ef' }}
    >
      <path d={d} fill="#1b1712" />
    </svg>
  )
}
