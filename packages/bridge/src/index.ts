export { type BridgeConfig, createBridge } from './bridge.js'
export { createLedger, type Ledger, type LedgerEntry } from './ledger.js'
export { assertPublicTarget, BlockedTargetError, isPrivateAddress, type TargetPolicy } from './ssrf.js'

/** The agent's side: the URL that pays an ordinary x402 endpoint through the bridge from a Flying Money budget. */
export function viaBridge(bridgeUrl: string, targetUrl: string): string {
  return `${bridgeUrl.replace(/\/$/, '')}/fetch?url=${encodeURIComponent(targetUrl)}`
}
