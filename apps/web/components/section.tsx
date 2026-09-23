import Link from 'next/link'
import type { ReactNode } from 'react'

/** Formal Chinese numerals used as chapter marks (pending native-reader review, H8). */
export const CHAPTER = ['壹', '貳', '參', '肆', '伍', '陸', '柒'] as const

export function Chapter({
  id,
  n,
  eyebrow,
  title,
  children,
  className = '',
}: {
  id: string
  n: number
  eyebrow: string
  title: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={`reveal mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20 ${className}`}
    >
      <div className="flex items-start gap-5">
        <span className="chapter-mark mt-1 hidden sm:inline-grid" aria-hidden lang="zh-Hant">
          {CHAPTER[n - 1]}
        </span>
        <div>
          <p className="smallcaps text-sm text-seal">
            Chapter {n} · {eyebrow}
          </p>
          <h2
            id={`${id}-title`}
            className="mt-1 max-w-3xl font-display text-4xl font-semibold leading-[1.05] tracking-tight text-balance sm:text-[3.4rem]"
          >
            {title}
          </h2>
        </div>
      </div>
      <div className="mt-10">{children}</div>
    </section>
  )
}

/** Kept for simple pages. */
export function Section({
  id,
  eyebrow,
  title,
  children,
  className = '',
}: {
  id: string
  eyebrow?: string
  title: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={`mx-auto max-w-6xl px-4 py-16 sm:px-6 ${className}`}>
      {eyebrow && <p className="smallcaps text-sm text-seal">{eyebrow}</p>}
      <h2
        id={`${id}-title`}
        className="mt-1 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-balance sm:text-5xl"
      >
        {title}
      </h2>
      <div className="mt-8">{children}</div>
    </section>
  )
}

/** A sheet of rice paper with a torn edge. */
export function Sheet({
  children,
  className = '',
  as: As = 'div',
  tilt = 0,
}: {
  children: ReactNode
  className?: string
  as?: 'div' | 'section' | 'article' | 'aside' | 'figure'
  tilt?: number
}) {
  return (
    <As className={`sheet ${className}`} style={tilt ? { transform: `rotate(${tilt}deg)` } : undefined}>
      {children}
    </As>
  )
}

const buttonBase =
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-[3px] px-6 py-2.5 text-base font-semibold transition-[background-color,box-shadow,transform] duration-150 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo'

const variants = {
  primary: 'bg-seal-button text-on-seal shadow-[0_2px_0_0_rgb(90_20_15/0.45)] hover:bg-seal-button/90',
  secondary: 'border border-ink/40 bg-paper/60 text-ink hover:border-ink hover:bg-paper',
} as const

export function ButtonLink({
  href,
  children,
  variant = 'primary',
}: {
  href: string
  children: ReactNode
  variant?: keyof typeof variants
}) {
  const cls = `${buttonBase} ${variants[variant]}`
  return href.startsWith('/') ? (
    <Link href={href} className={cls}>
      {children}
    </Link>
  ) : (
    <a href={href} className={cls}>
      {children}
    </a>
  )
}

export const buttonClass = (variant: keyof typeof variants = 'primary') =>
  `${buttonBase} ${variants[variant]} disabled:cursor-not-allowed disabled:opacity-50`
