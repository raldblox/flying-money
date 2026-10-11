import type { ChainConfig } from '@flying-money/chains'
import { usdc } from '@/lib/fmt'
import { deployedChains } from '@/lib/wagmi'

/** The real-money note for a mainnet: said next to the money, with the caps that bound the risk. */
export function RealMoneyNote({ chain, className = '' }: { chain: ChainConfig; className?: string }) {
  return (
    <p className={`rounded-md border border-seal bg-seal/5 px-3 py-2 text-sm text-ink ${className}`}>
      <strong>Real money on {chain.chain.name}.</strong> Budgets here hold real USDC
      {chain.gasToken === 'USDC' ? ', and USDC also pays the network fee' : ''}. The contract is not audited, so a
      budget is capped at {usdc(chain.maxFaceValue, { min: 0 })} USDC and the whole deployment at{' '}
      {usdc(chain.maxTotalOutstanding, { min: 0 })} USDC.
    </p>
  )
}

/**
 * Test networks: practice money, said next to the money at every width (BUILD_SPEC §22.4). Pass the network when the
 * page knows it: a mainnet gets the real-money note instead. Without one, it says both, because the app can hold both.
 */
export function TestNote({ className = '', chain }: { className?: string; chain?: ChainConfig }) {
  if (chain?.mainnet) return <RealMoneyNote chain={chain} className={className} />
  const chains = deployedChains()
  if (chains.length > 0 && chains.every((c) => c.mainnet)) return null
  const mainnet = chain ? undefined : chains.find((c) => c.mainnet)
  return (
    <p className={`rounded-md border border-amber/50 bg-amber/10 px-3 py-2 text-sm text-ink ${className}`}>
      {mainnet
        ? `Test networks: practice money with no value. ${mainnet.brand} mainnet is real USDC, capped and not audited.`
        : 'Test network: practice money with no value. Not audited.'}
    </p>
  )
}
