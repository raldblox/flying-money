import { expect, test } from '@playwright/test'

// The bridge monitoring page reads a bridge's public /status and shows balances, health, what is owed and collected,
// and a log whose transactions link to the explorer. It never shows agent identities.
const STATUS = {
  name: 'Test bridge',
  wallet: '0x00000000000000000000000000000000000b01d9',
  budgetChains: ['anvil'],
  limits: { maxPerCall: '5000', feeBps: 0, quotesPerMinute: 60 },
  balances: [{ network: 'eip155:31337', usdc: '20000', gas: '1000000000000000' }],
  liquidity: {
    health: 'low',
    coversCalls: '5',
    basedOnPrice: '1000',
    note: 'The bridge pays each site from its own wallet first, then collects the budget from the contract.',
  },
  owedByContract: '2000',
  totals: {
    paid: 3,
    failed: 1,
    spentOnSites: '3000',
    chargedToAgents: '3000',
    collected: '1000',
    since: 1_791_748_685_000,
  },
  recent: [
    { at: 1_791_748_811_000, kind: 'collected', network: 'eip155:31337', amount: '1000', tx: `0x${'ab'.repeat(32)}` },
    {
      at: 1_791_748_685_000,
      kind: 'paid',
      host: 'api.example.test',
      network: 'eip155:31337',
      amount: '1000',
      price: '1000',
    },
  ],
}

test('the bridge page shows health, what is owed and paid, and the activity log', async ({ page }) => {
  await page.route('http://bridge.test/status', (route) =>
    route.fulfill({ json: STATUS, headers: { 'access-control-allow-origin': '*' } }),
  )
  await page.goto('/bridge?url=http%3A%2F%2Fbridge.test', { timeout: 120_000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Check a bridge.' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Test bridge' })).toBeVisible()
  await expect(page.getByText('Low: top up soon')).toBeVisible()
  await expect(page.getByText('5 calls')).toBeVisible()
  await expect(page.getByText('Owed to it by the contract')).toBeVisible()
  const log = page.getByRole('table', { name: 'Recent bridge activity' })
  await expect(log).toContainText('Paid api.example.test')
  await expect(log).toContainText('Collected from budgets')
  await expect(page.getByRole('heading', { name: 'Check it against the chain' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'What to trust' })).toBeVisible()
})

test('without a bridge address the page explains itself and offers the form', async ({ page }) => {
  await page.goto('/bridge', { timeout: 120_000 })
  await expect(page.getByLabel('Bridge address')).toBeVisible()
  await expect(page.getByRole('link', { name: 'how to run a bridge' })).toHaveAttribute('href', '/docs/bridge')
})
