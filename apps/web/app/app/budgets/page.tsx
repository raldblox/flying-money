import type { Metadata } from 'next'
import { BudgetsList } from '@/components/account/budgets'

export const metadata: Metadata = { title: 'Budgets', robots: { index: false } }

export default function BudgetsPage() {
  return <BudgetsList />
}
