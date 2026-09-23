/**
 * A stylised map of Tang China: the Yellow River and the Yangtze, the historic cities of the demo, and the
 * caravan road from Dunhuang to Yangzhou. Positions follow real longitude/latitude, drawn with a brush.
 * Decorative, with a text alternative for screen readers.
 */
const CITIES: Array<{ name: string; x: number; y: number; capital?: boolean; dx?: number; dy?: number }> = [
  { name: 'Dunhuang', x: 131, y: 58, dy: -14 },
  { name: "Chang'an", x: 470, y: 146, capital: true, dy: 26 },
  { name: 'Luoyang', x: 553, y: 141, dy: -14 },
  { name: 'Kaifeng', x: 597, y: 138, dx: 34, dy: 20 },
  { name: 'Yangzhou', x: 719, y: 174, dx: 8, dy: -14 },
  { name: 'Hangzhou', x: 736, y: 206, dx: 4, dy: 22 },
  { name: 'Chengdu', x: 354, y: 200, dy: 24 },
  { name: 'Guangzhou', x: 572, y: 313, dy: 24 },
]

export function SilkRoadMap({ className = '', animate = true }: { className?: string; animate?: boolean }) {
  return (
    <svg
      viewBox="0 0 800 360"
      role="img"
      aria-label="Map of Tang China: a caravan road runs from Dunhuang in the west through Chang'an and Luoyang to Yangzhou in the east."
      className={className}
    >
      <defs>
        <radialGradient id="land" cx="50%" cy="45%" r="65%">
          <stop offset="0" stopColor="var(--ochre)" stopOpacity="0.16" />
          <stop offset="1" stopColor="var(--ochre)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="420" cy="190" rx="410" ry="170" fill="url(#land)" filter="url(#wash)" />

      {/* rivers */}
      <g fill="none" stroke="var(--indigo)" strokeOpacity="0.45" strokeLinecap="round" filter="url(#ink-bleed)">
        <path
          d="M250 150 C 300 120, 340 70, 400 60 S 470 40, 500 90 S 520 130, 560 128 S 660 120, 760 112"
          strokeWidth="2.2"
        />
        <path d="M300 250 C 360 230, 400 215, 450 220 S 560 214, 620 200 S 700 186, 770 192" strokeWidth="2.6" />
      </g>
      <text x="408" y="52" className="fill-indigo" fontSize="11" fontStyle="italic" opacity="0.7">
        Yellow River
      </text>
      <text x="470" y="236" className="fill-indigo" fontSize="11" fontStyle="italic" opacity="0.7">
        Yangtze
      </text>

      {/* the caravan road */}
      <path
        d="M131 58 C 220 70, 300 110, 380 128 S 440 146, 470 146 L 553 141 L 597 138 C 650 146, 690 162, 719 174"
        fill="none"
        stroke="var(--seal)"
        strokeWidth="2.5"
        strokeDasharray="7 7"
        strokeLinecap="round"
        className={animate ? 'road-march' : ''}
      />

      {/* cities */}
      {CITIES.map((c) => (
        <g key={c.name}>
          {c.capital ? (
            <rect
              x={c.x - 7}
              y={c.y - 7}
              width="14"
              height="14"
              fill="var(--paper)"
              stroke="var(--seal)"
              strokeWidth="2.5"
              transform={`rotate(-4 ${c.x} ${c.y})`}
            />
          ) : (
            <circle cx={c.x} cy={c.y} r="4.5" fill="var(--ink)" />
          )}
          <text
            x={c.x + (c.dx ?? 0)}
            y={c.y + (c.dy ?? 0)}
            textAnchor="middle"
            fontSize={c.capital ? 15 : 12.5}
            fontFamily="var(--font-display)"
            fontWeight={c.capital ? 700 : 600}
            className="fill-ink"
          >
            {c.name}
          </text>
        </g>
      ))}

      {/* compass */}
      <g transform="translate(90 290)" stroke="var(--ink)" strokeOpacity="0.55" fill="none">
        <circle r="22" />
        <path d="M0 -30 L 5 0 L 0 30 L -5 0 Z" fill="var(--ink)" fillOpacity="0.15" />
        <text y="-36" textAnchor="middle" fontSize="11" className="fill-ink" stroke="none">
          N
        </text>
      </g>
      <text x="780" y="345" textAnchor="end" fontSize="11" className="fill-ink-2" fontStyle="italic">
        Illustrative map · not to scale
      </text>
    </svg>
  )
}
