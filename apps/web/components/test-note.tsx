import { deployedChains } from '@/lib/wagmi'

/** Test networks: practice money, said next to the money at every width (BUILD_SPEC §22.4). */
export function TestNote({ className = '' }: { className?: string }) {
  // the app's money flows run on the test networks; only a deployment that is all mainnet drops the note
  const chains = deployedChains()
  if (chains.length > 0 && chains.every((c) => c.mainnet)) return null
  return (
    <p className={`rounded-md border border-amber/50 bg-amber/10 px-3 py-2 text-sm text-ink ${className}`}>
      Test network: practice money with no value. Not audited.
    </p>
  )
}
