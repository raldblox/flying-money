export { type BridgeConfig, createBridge } from './bridge.js'
export { createLedger, type Ledger, type LedgerEntry, type LedgerTotals } from './ledger.js'
export { type Delivered, fileOutcomes, memoryOutcomes, type OutcomeStore } from './outcomes.js'
export { redisLedger, redisOutcomes } from './redis-stores.js'
export { assertPublicTarget, BlockedTargetError, isPrivateAddress, type TargetPolicy } from './ssrf.js'

/** The agent's side: the URL that pays an ordinary x402 endpoint through the bridge from a Flying Money budget. */
export function viaBridge(bridgeUrl: string, targetUrl: string): string {
  return `${bridgeUrl.replace(/\/$/, '')}/fetch?url=${encodeURIComponent(targetUrl)}`
}
export { HOBBY_SAFETY_SECONDS, hostedBridgeFromEnv, PRO_SAFETY_SECONDS } from './hosted.js'
export { chainReaders, logCollection } from './readers.js'
export { bridgeSkillMd, type SkillInfo } from './skill.js'
