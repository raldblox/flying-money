import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { privateKeyToAccount } from 'viem/accounts'

// §17 Sprint B: Playwright issue → redeem on anvil, through the account area. The browser wallet is wagmi's mock
// connector (anvil #1). Moving between account pages must keep the wallet connected.
const root = join(import.meta.dirname, '..')
// E2E_SHOTS=1 saves full-page screenshots of the account screens (for design review)
const shot = async (page: import('@playwright/test').Page, name: string) => {
  if (process.env.E2E_SHOTS) await page.screenshot({ path: `test-results/shots/${name}.png`, fullPage: true })
}
const state = () => JSON.parse(readFileSync(join(root, '.e2e-state.json'), 'utf8')) as { spenderKey: `0x${string}` }
const sign = (id: string, cumulative: bigint) => {
  if (!/^0x[0-9a-f]{64}$/.test(id)) throw new Error('bad certificate id')
  return execSync(`pnpm -s e2e:anvil sign ${id} ${cumulative}`, { cwd: root }).toString().trim().split('\n').at(-1)!
}

test('fund an agent from the account, see it on Home and Budgets, collect as the payee, refuse the replay', async ({
  page,
}) => {
  await page.goto('/app')
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByText('Available in your wallet')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible()

  // Home → Fund an agent (the step-by-step form is its own page)
  await page.getByRole('link', { name: /Fund an agent/ }).click()
  // first visit to a page compiles it in dev: allow for that
  await expect(page.getByRole('heading', { name: 'Fund an agent' })).toBeVisible({ timeout: 90_000 })
  await shot(page, '2-fund-an-agent')
  // pay to our own address (payee may equal funder; only the spender must differ)
  const funder = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
  await page.getByText('Paste a payee address').click()
  await page.getByRole('textbox', { name: 'Payee address' }).fill(funder)
  await page.getByText('I checked this address twice').click()
  // a pasted payee keeps a "new payee" warning in view while funding
  await expect(page.getByText('New payee: you haven’t verified this address')).toBeVisible()
  const spender = privateKeyToAccount(state().spenderKey).address
  await page.getByRole('textbox', { name: 'Agent (spender) address' }).fill(spender)
  await page.getByRole('button', { name: /Approve 5.00 USDC/ }).click()
  await page.getByRole('button', { name: /Create the budget/ }).click()
  await expect(page.getByText('Budget created.')).toBeVisible({ timeout: 60_000 })
  const id = (await page.locator('p.font-mono.break-all').first().textContent())!.trim()
  expect(id).toMatch(/^0x[0-9a-f]{64}$/)

  // Home lists it (still connected after moving pages)
  await page.getByRole('navigation', { name: 'Account' }).getByRole('link', { name: 'Home' }).click()
  await expect(page.getByText('Your budgets')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText('5.00 / 5.00').first()).toBeVisible({ timeout: 30_000 })
  await shot(page, '1-home')
  // Budgets shows it under Active
  await page.getByRole('navigation', { name: 'Account' }).getByRole('link', { name: 'Budgets' }).click()
  await expect(page.getByRole('button', { name: /Active/ })).toHaveAttribute('aria-pressed', 'true', {
    timeout: 90_000,
  })
  await expect(page.getByText('5.00 / 5.00').first()).toBeVisible({ timeout: 30_000 })

  await shot(page, '3-budgets')
  // an unnamed payee is flagged, and can be named in place
  const row = page.locator('li', { hasText: '5.00 / 5.00' }).first()
  await expect(row.getByText('Not saved')).toBeVisible()
  await row.getByRole('button', { name: 'Save as a place…' }).click()
  await row.getByRole('textbox').fill('My test shop')
  await row.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(row.getByText('My test shop')).toBeVisible()
  await expect(row.getByText('Not saved')).toHaveCount(0)

  // phone width: the account screens fit without sideways scrolling
  if (process.env.E2E_SHOTS) {
    await page.setViewportSize({ width: 375, height: 812 })
    const fits = async (name: string) => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
      await shot(page, name)
    }
    await fits('m-budgets')
    await page.getByRole('navigation', { name: 'Account' }).getByRole('link', { name: 'Home' }).click()
    await expect(page.getByText('Your budgets')).toBeVisible({ timeout: 90_000 })
    await expect(page.getByText('5.00 / 5.00').first()).toBeVisible({ timeout: 30_000 })
    await fits('m-home')
    await page.getByRole('link', { name: /Fund an agent/ }).click()
    await expect(page.getByRole('heading', { name: 'Fund an agent' })).toBeVisible({ timeout: 90_000 })
    await page.getByText('Paste a payee address').click()
    await page.getByRole('textbox', { name: 'Payee address' }).fill(funder)
    await expect(page.getByText('New payee: you haven’t verified this address')).toBeVisible()
    await fits('m-fund')
    await page.getByRole('navigation', { name: 'Account' }).getByRole('link', { name: 'Budgets' }).click()
    await expect(page.getByText('5.00 / 5.00').first()).toBeVisible({ timeout: 90_000 })
    await page.setViewportSize({ width: 1280, height: 800 })
  }
  // Collect 2.50 as the payee
  await page.getByRole('navigation', { name: 'Account' }).getByRole('link', { name: 'Collect' }).click()
  const card = page.locator('article', { hasText: id.slice(0, 6) })
  await expect(card).toBeVisible({ timeout: 90_000 })
  const note = sign(id, 2_500_000n)
  await card.getByRole('textbox').fill(note)
  await card.getByRole('button', { name: /^Collect/ }).click()
  await expect(card.getByText('Confirmed')).toBeVisible({ timeout: 60_000 })
  await expect(card).toContainText('2.50')

  // The same note again adds nothing: refused before any transaction
  await card.getByRole('textbox').fill(note)
  await expect(card.getByText(/Already collected/)).toBeVisible()
})
