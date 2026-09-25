import type { Hex } from '@flying-money/core'
import type { ReactNode } from 'react'
import { AccountProvider } from '@/components/account/context'
import { AccountShell } from '@/components/account/shell'

// read at request time: the build step does not receive server env (turbo strict env)
export const dynamic = 'force-dynamic'

/** Everything under /app shares one account: navigation, network and wallet. */
export default function AccountLayout({ children }: { children: ReactNode }) {
  const payee = process.env.PAYEE_ADDRESS
  const oraclePayee = payee && /^0x[0-9a-fA-F]{40}$/.test(payee) ? (payee as Hex) : undefined
  return (
    <AccountProvider
      defaultChain={process.env.NEXT_PUBLIC_DEFAULT_CHAIN ?? 'arbitrum-sepolia'}
      {...(oraclePayee ? { oraclePayee } : {})}
    >
      <AccountShell>{children}</AccountShell>
    </AccountProvider>
  )
}
