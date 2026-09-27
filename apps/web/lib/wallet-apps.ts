/**
 * Open this page inside a phone wallet app's own browser (BUILD_SPEC §22.10 d). Phone browsers have no wallet; the
 * wallet apps' browsers do. These are the apps' published deep-link formats.
 */
export function walletAppLinks(pageUrl: string): Array<{ name: string; href: string }> {
  const u = new URL(pageUrl)
  const hostPath = `${u.host}${u.pathname}${u.search}`
  return [
    { name: 'MetaMask', href: `https://metamask.app.link/dapp/${hostPath}` },
    { name: 'Coinbase Wallet', href: `https://go.cb-w.com/dapp?cb_url=${encodeURIComponent(u.toString())}` },
  ]
}

/** A browser wallet is present when a provider was injected into the page. */
export function hasBrowserWallet(w: unknown = typeof window === 'undefined' ? undefined : window): boolean {
  return Boolean(w && typeof w === 'object' && 'ethereum' in w && (w as { ethereum?: unknown }).ethereum)
}
