import type { Metadata } from 'next'
import { AccountHome } from '@/components/account/home'

export const metadata: Metadata = {
  title: 'Account',
  description: 'Your budgets, requests and payments in one place.',
}

export default function AccountPage() {
  return <AccountHome />
}
