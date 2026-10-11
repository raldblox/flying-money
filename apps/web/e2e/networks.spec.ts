import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

// Judges and builders look for their chain: /networks lists every network, mainnets and test networks kept apart, and
// /mainnet and /testnet are the same page filtered. Real-money cards never offer the (test-money) demos.
test('networks hub separates mainnets from test networks and routes each to the right actions', async ({ page }) => {
  await page.goto('/networks', { timeout: 120_000 })
  await expect(page.getByRole('heading', { level: 1, name: 'Find your network.' })).toBeVisible()
  const mainnet = page.getByRole('region', { name: 'Mainnets · real money' })
  const testnet = page.getByRole('region', { name: 'Test networks · practice money' })
  await expect(mainnet.locator('[data-network]')).toHaveCount(2)
  await expect(testnet.locator('[data-network]')).not.toHaveCount(0)

  const base = mainnet.locator('[data-network="base-mainnet"]')
  await expect(base).toContainText('Mainnet · real USDC')
  await expect(base).toContainText('1,000 USDC per budget')
  await expect(base.getByRole('link', { name: /Give a budget/ })).toHaveAttribute(
    'href',
    '/app/give?chain=base-mainnet',
  )
  await expect(base.getByRole('link', { name: /demo/i })).toHaveCount(0)

  const sepolia = testnet.locator('[data-network="base-sepolia"]')
  await expect(sepolia).toContainText('Testnet · test money')
  await expect(sepolia.getByRole('link', { name: 'Try the shop demo' })).toHaveAttribute(
    'href',
    '/demo/counter?chain=base-sepolia',
  )

  // the filtered pages
  await page.goto('/mainnet')
  await expect(page.getByRole('region', { name: 'Mainnets · real money' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Test networks · practice money' })).toHaveCount(0)
  await page.goto('/testnet')
  await expect(page.getByRole('region', { name: 'Mainnets · real money' })).toHaveCount(0)
  await expect(page.locator('[data-network="arbitrum-sepolia"]')).toBeVisible()

  const results = await new AxeBuilder({ page }).analyze()
  expect(results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
})

test('the per-chain page offers real-money actions on a mainnet and the demos only on a test network', async ({
  page,
}) => {
  await page.goto('/chains/base-mainnet', { timeout: 120_000 })
  await expect(page.getByRole('link', { name: /Give a budget/ })).toHaveAttribute(
    'href',
    '/app/give?chain=base-mainnet',
  )
  await expect(page.getByRole('link', { name: 'Watch an agent pay' })).toHaveCount(0)
  await page.goto('/chains/base-sepolia')
  await expect(page.getByRole('link', { name: 'Try the shop demo' })).toHaveAttribute(
    'href',
    '/demo/counter?chain=base-sepolia',
  )
})
