/**
 * The maker's mark: the 騎縫 tally seal. A seal stamped across the seam of two certificate halves, so it is whole
 * only when they meet (how the 804 feiqian halves were matched). Files in public/brand/ (see docs/brand/).
 * Rendered as <img> so each copy's SVG ids stay isolated; the small cut is used at 32 px and below.
 */
export function BrandMark({ size = 44, className = '', label }: { size?: number; className?: string; label?: string }) {
  return (
    // biome-ignore lint/performance/noImgElement: a tiny static SVG; next/image adds nothing here
    <img
      src={size <= 32 ? '/brand/mark-small.svg' : '/brand/mark.svg'}
      width={size}
      height={size}
      alt={label ?? ''}
      aria-hidden={label ? undefined : true}
      className={className}
      draggable={false}
    />
  )
}
