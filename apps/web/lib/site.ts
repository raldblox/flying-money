/** Site-wide constants. The domain is a placeholder until H6 (§18: check availability and trademarks first). */
export const SITE = {
  name: 'Flying Money',
  han: '飛錢',
  domain: 'flyingmoney.xyz',
  github: 'https://github.com/raldblox/flying-money',
  /** The status line every page that handles funds must state (§20). */
  testnetMode: 'Testnet · test money · unaudited',
  mainnetMode: 'Mainnet · real USDC · unaudited · capped at 100 USDC',
  footerStatus: 'Testnets + capped mainnets · unaudited',
} as const
