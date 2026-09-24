/** Site-wide constants. The domain is a placeholder until H6 (§18: check availability and trademarks first). */
export const SITE = {
  name: 'Flying Money',
  han: '飛錢',
  domain: 'flyingmoney.xyz',
  /** Where the site is live today (Vercel); a custom domain replaces it after H6. */
  url: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://useflyingmoney.vercel.app',
  github: 'https://github.com/raldblox/flying-money',
  /** The status line every page that handles funds must state (§20). */
  testnetMode: 'Testnet · test money · unaudited',
  mainnetMode: 'Mainnet · real USDC · unaudited · capped at 100 USDC',
} as const
