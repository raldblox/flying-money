import { expect, test } from '@playwright/test'

// BUILD_SPEC §22.2 A5: a spending key generated in the browser survives a reload after the budget is created, until
// the funder confirms the hand-over; then it is forgotten.
test('a generated key and its hand-over survive a reload until the funder confirms', async ({ page }) => {
  await page.goto('/app/give?for=person')
  await page.getByRole('button', { name: 'Connect wallet' }).first().click({ timeout: 90_000 })
  await page.getByText('Paste a payee address').click({ timeout: 90_000 })
  await page.getByRole('textbox', { name: 'Payee address' }).fill('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')
  await page.getByText('I checked this address twice').click()
  await page.getByRole('button', { name: 'Generate a spending key' }).click()
  await page.getByText('I saved the key').click()
  await page.getByRole('button', { name: /Approve 5 USDC/ }).click()
  await page.getByRole('button', { name: 'Create the budget' }).click({ timeout: 60_000 })
  await expect(page.getByText('Budget created.')).toBeVisible({ timeout: 60_000 })
  const id = (await page.locator('p.font-mono.break-all').first().textContent())!.trim()

  // reload (the test wallet has to reconnect): the result and the hand-over are still there
  await page.reload()
  await page.getByRole('button', { name: 'Connect wallet' }).first().click({ timeout: 90_000 })
  await expect(page.getByText('Budget created.')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(id).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show the hand-over link and QR' })).toBeVisible()

  // confirmed: forgotten, and a reload starts fresh
  await page.getByRole('button', { name: 'I’ve handed it over' }).click()
  await expect(page.getByText('Budget created.')).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Connect wallet' }).first().click({ timeout: 90_000 })
  await expect(page.getByText('Paste a payee address')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText('Budget created.')).toHaveCount(0)
})
