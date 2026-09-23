/**
 * Ink-wash landscape (shan shui): layered ridges fading into mist.
 * Decorative: aria-hidden. Colours come from theme tokens, so it works in light and dark.
 */
export function InkMountains({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 1200 420"
      preserveAspectRatio="xMidYMax slice"
      className={className}
      focusable="false"
    >
      <defs>
        <linearGradient id="ridge-far" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--ink)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--ink)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="ridge-mid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--ink)" stopOpacity="0.28" />
          <stop offset="0.7" stopColor="var(--ink)" stopOpacity="0.04" />
        </linearGradient>
        <linearGradient id="ridge-near" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--ink)" stopOpacity="0.5" />
          <stop offset="0.8" stopColor="var(--ink)" stopOpacity="0.06" />
        </linearGradient>
      </defs>
      {/* far ridges */}
      <path
        filter="url(#wash)"
        fill="url(#ridge-far)"
        d="M0 250 C 90 190, 150 220, 220 170 S 360 120, 430 180 S 560 150, 640 110 S 780 170, 860 150 S 1010 90, 1080 140 S 1170 170, 1200 160 L1200 420 L0 420 Z"
      />
      {/* middle ridges */}
      <path
        filter="url(#wash)"
        fill="url(#ridge-mid)"
        d="M0 300 C 60 260, 120 280, 180 230 S 290 200, 340 250 S 450 280, 520 220 S 610 170, 690 230 S 800 290, 870 250 S 980 210, 1050 250 S 1150 280, 1200 260 L1200 420 L0 420 Z"
      />
      {/* near peaks with brush contour */}
      <path
        filter="url(#wash)"
        fill="url(#ridge-near)"
        d="M-20 420 L 60 330 C 90 300, 110 310, 140 280 L 190 240 C 210 225, 230 240, 250 262 L 300 320 C 320 340, 350 330, 380 350 L 420 420 Z"
      />
      <path
        filter="url(#wash)"
        fill="url(#ridge-near)"
        d="M760 420 L 820 350 C 850 320, 870 330, 900 300 L 950 262 C 975 245, 1000 260, 1020 285 L 1080 350 C 1110 380, 1150 360, 1220 420 Z"
      />
      <path
        d="M140 280 L 190 240 C 210 225, 230 240, 250 262 M900 300 L 950 262 C 975 245, 1000 260, 1020 285"
        fill="none"
        stroke="var(--ink)"
        strokeOpacity="0.45"
        strokeWidth="2.2"
        strokeLinecap="round"
        filter="url(#ink-bleed)"
      />
      {/* mist */}
      <rect x="0" y="300" width="1200" height="120" fill="url(#ridge-far)" opacity="0" />
      {/* a pine on the near ridge */}
      <g stroke="var(--ink)" strokeOpacity="0.55" strokeLinecap="round" fill="none" filter="url(#ink-bleed)">
        <path d="M205 245 C 206 225, 204 210, 208 192" strokeWidth="2" />
        <path d="M190 212 L 222 206 M192 222 L 224 218 M196 232 L 222 229" strokeWidth="2.4" />
      </g>
    </svg>
  )
}
