import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, Inter, JetBrains_Mono, Noto_Serif_TC } from 'next/font/google'
import type { ReactNode } from 'react'
import { SiteFooter } from '@/components/site-footer'
import { SiteHeader } from '@/components/site-header'
import './globals.css'

const display = Cormorant_Garamond({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-cormorant' })
const sans = Inter({ subsets: ['latin'], variable: '--font-inter' })
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' })
// The Chinese display mark 飛錢 (§11.2). Loaded without preload; glyphs are fetched on demand.
const han = Noto_Serif_TC({ weight: ['600'], variable: '--font-noto-tc', preload: false })

export const metadata: Metadata = {
  title: { default: 'Flying Money: sealed spending certificates', template: '%s · Flying Money' },
  description:
    'Give your AI agent a sealed certificate, not your wallet. Lock a budget for one seller; the holder pays with signed notes the seller verifies instantly.',
  applicationName: 'Flying Money',
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f4ede0' },
    { media: '(prefers-color-scheme: dark)', color: '#15130f' },
  ],
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable} ${han.variable}`}>
      <body className="grain min-h-dvh flex flex-col antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-paper-2 focus:px-3 focus:py-2"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}
