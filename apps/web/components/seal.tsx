import { BrandMark } from './brand-mark'

/**
 * The vermilion seal (§11.1): shown ONLY when something is actually signed or verified. Never decoration.
 * It is the brand's 騎縫 tally seal, stamped in (180 ms) when `animate` is set.
 */
export function Seal({
  size = 40,
  animate = false,
  label = 'Sealed',
}: {
  size?: number
  animate?: boolean
  label?: string
}) {
  return (
    <span role="img" aria-label={label} className={`inline-block shrink-0 ${animate ? 'stamp-in' : '-rotate-2'}`}>
      <BrandMark size={size} />
    </span>
  )
}
