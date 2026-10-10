import { expect, test } from '@playwright/test'

test('saved wallet opens and keeps local setup after an actual offline reload', async ({ page, context }) => {
  await page.goto('/wallet')
  await expect(page.getByText('this page is saved for offline use', { exact: false })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Set up my wallet' }).click()
  await page.getByLabel('New PIN', { exact: true }).fill('123456')
  await page.getByLabel('Repeat the PIN', { exact: true }).fill('123456')
  await page.getByRole('button', { name: 'Create my wallet', exact: true }).click()
  await expect(page.getByLabel('New PIN', { exact: true })).toBeHidden()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Wallet · on this device', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Set up my wallet' })).toHaveCount(0)
  await expect(page.getByText('Opening your wallet…')).toBeHidden()
  await expect(page.getByRole('main').getByRole('alert')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Add', exact: true })).toBeVisible()
})

test('an uncached till never opens another shop’s cached screen', async ({ page, context }) => {
  await page.goto('/wallet')
  await expect(page.getByText('this page is saved for offline use', { exact: false })).toBeVisible({ timeout: 60_000 })
  await context.setOffline(true)
  const response = await page.goto('/shop/not-saved')
  expect(response?.status()).toBe(503)
  await expect(page.getByText('This page is not saved for offline use.', { exact: false })).toBeVisible()
})

test('a second tab cannot open the same wallet for writing', async ({ page, context }) => {
  await page.goto('/wallet')
  await expect(page.getByRole('button', { name: 'Set up my wallet' })).toBeVisible()
  const second = await context.newPage()
  await second.goto('/wallet')
  await expect(second.getByRole('main').getByRole('alert')).toContainText('already open in another tab')
})
