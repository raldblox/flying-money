import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Inter, JetBrains_Mono, Noto_Serif_TC } from 'next/font/google'
import type { ReactNode } from 'react'
import { Providers } from '@/app/app/providers'
import { PaperDefs } from '@/components/art/paper-defs'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import { THEME_SCRIPT } from '@/lib/theme'
import './globals.css'

const display = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
})
const sans = Inter({ subsets: ['latin'], variable: '--font-inter' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })
// The Chinese display mark 飛錢 (§11.2). Loaded without preload; glyphs are fetched on demand.
const han = Noto_Serif_TC({ weight: ['600'], variable: '--font-noto-tc', preload: false })

export const metadata: Metadata = {
  title: { default: 'Flying Money: give a budget, not your wallet', template: '%s · Flying Money' },
  description:
    'Set aside USDC for one seller, one spending key, an amount and an end date. Experience sponsored shop and agent demos, then explore how signed payment slips work offline after budget verification.',
  applicationName: 'Flying Money',
  manifest: '/manifest.webmanifest',
  icons: { icon: { url: '/icon.svg', type: 'image/svg+xml' }, apple: '/brand/apple-touch-icon.png' },
  appleWebApp: { capable: true, title: 'Flying Money', statusBarStyle: 'default' },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4ede0' },
    { media: '(prefers-color-scheme: dark)', color: '#15130f' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      data-scroll-behavior="smooth"
      className={`${display.variable} ${sans.variable} ${mono.variable} ${han.variable}`}
    >
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: fixed theme bootstrap allowed by its exact CSP hash */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-dvh flex flex-col antialiased">
        <PaperDefs />
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-paper-2 focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        {/* one wallet connection for the whole site, so moving between pages never disconnects it */}
        <Providers>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  )
}
