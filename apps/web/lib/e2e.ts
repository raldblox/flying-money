import { setLocalDeployment } from '@flying-money/chains'
import type { Hex } from 'viem'

/**
 * Local end-to-end test mode ONLY (DECISIONS D19; never set in production): pages talk to a private anvil.
 * Imported by every module that reads chain data in the browser, so the local deployment is registered first.
 */
export const E2E = {
  rpc: process.env.NEXT_PUBLIC_FM_E2E_ANVIL,
  usdc: process.env.NEXT_PUBLIC_FM_E2E_USDC as Hex | undefined,
  contract: process.env.NEXT_PUBLIC_FM_E2E_CONTRACT as Hex | undefined,
  account: process.env.NEXT_PUBLIC_FM_E2E_ACCOUNT as Hex | undefined,
}
export const e2eMode = Boolean(E2E.rpc && E2E.usdc && E2E.contract && E2E.account)
if (e2eMode) setLocalDeployment({ usdc: E2E.usdc!, flyingMoney: E2E.contract! })
