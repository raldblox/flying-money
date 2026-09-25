'use client'
import { PayeeList } from '@/components/app/certificate-lists'
import { useAccountCtx } from './context'

/** The payee view (§12.3): budgets that name your wallet as the one who can be paid. */
export function Collect() {
  const { chain, refreshKey } = useAccountCtx()
  return (
    <div>
      <h1 className="font-display text-4xl font-semibold">Collect</h1>
      <p className="mt-2 max-w-2xl text-ink-2">
        Budgets where your wallet is the one who can be paid. Paste the latest payment slip a customer or agent gave you
        and collect it in one transaction. Shops using a till collect from the till instead.
      </p>
      <div className="mt-6">
        <PayeeList chain={chain} refreshKey={refreshKey} />
      </div>
    </div>
  )
}
