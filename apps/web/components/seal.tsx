/**
 * The vermilion seal (§11.1): shown ONLY when something is actually signed or verified. Never decoration.
 * The character is 飛 ("to fly"); Chinese text awaits native-reader review (H8).
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
    <span
      role="img"
      aria-label={label}
      lang="zh-Hant"
      className={`inline-grid shrink-0 place-items-center rounded-md border-2 border-seal bg-paper font-han leading-none text-seal ${animate ? 'stamp-in' : '-rotate-2'}`}
      style={{ width: size, height: size, fontSize: size * 0.55 }}
    >
      飛
    </span>
  )
}
