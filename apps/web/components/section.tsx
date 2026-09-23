import Link from 'next/link'
import type { ReactNode } from 'react'

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
      {eyebrow && <p className="text-xs font-medium uppercase tracking-[0.2em] text-seal">{eyebrow}</p>}
      <h2
        id={`${id}-title`}
        className="mt-2 max-w-3xl font-display text-4xl font-semibold leading-tight tracking-tight text-balance sm:text-5xl"
      >
        {title}
      </h2>
      <div className="mt-8">{children}</div>
    </section>
  )
}

const buttonBase =
  'inline-flex min-h-11 items-center justify-center rounded-md px-5 py-2.5 text-base font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo'

export function ButtonLink({
  href,
  children,
  variant = 'primary',
}: {
  href: string
  children: ReactNode
  variant?: 'primary' | 'secondary'
}) {
  const v =
    variant === 'primary'
      ? 'bg-seal-button text-on-seal hover:opacity-90'
      : 'border border-ink/30 text-ink hover:bg-paper-2'
  const cls = `${buttonBase} ${v}`
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

export const buttonClass = (variant: 'primary' | 'secondary' = 'primary') =>
  `${buttonBase} ${variant === 'primary' ? 'bg-seal-button text-on-seal hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50' : 'border border-ink/30 text-ink hover:bg-paper-2 disabled:opacity-50'}`
