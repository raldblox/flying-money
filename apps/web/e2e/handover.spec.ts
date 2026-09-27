import { expect, test } from '@playwright/test'

// BUILD_SPEC §22.2 A5: a spending key generated in the browser survives a reload after the budget is created, until
// the funder confirms the hand-over; then it is forgotten.
test('a generated key and its hand-over survive a reload until the funder confirms', async ({ page, browser }) => {
  test.setTimeout(360_000) // two browsers, two first compiles, several transactions
  await page.goto('/app/give?for=person')
  await page.getByRole('button', { name: 'Connect wallet' }).first().click({ timeout: 90_000 })
  // §22.5 d: three short screens, no agent file, no config snippet
  await expect(page.getByText('Step 1 of 3')).toBeVisible({ timeout: 90_000 })
  await page.getByRole('textbox', { name: 'Who is it for?' }).fill('Mia')
  await page.getByText('Paste a payee address').click()
  await page.getByRole('textbox', { name: 'Payee address' }).fill('0x70997970C51812dc3A010C7d01b50e0d17dc79C8')
  await page.getByText('I checked this address twice').click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('textbox', { name: /Amount/ })).toBeVisible()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText(/used by Mia/)).toBeVisible()
  await expect(page.getByText(/\.env/)).toHaveCount(0)
  await page.getByRole('button', { name: /Approve 5.00 USDC/ }).click()
  await page.getByRole('button', { name: /Create the budget/ }).click({ timeout: 60_000 })
  await expect(page.getByText('Budget created.')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByText('Now give it to Mia')).toBeVisible()
  await expect(page.getByText(/certificates: \[/)).toHaveCount(0)
  const id = (await page.locator('p.font-mono.break-all').first().textContent())!.trim()

  // reload (the test wallet has to reconnect): the result and the hand-over are still there
  await page.reload()
  await page.getByRole('button', { name: 'Connect wallet' }).first().click({ timeout: 90_000 })
  await expect(page.getByText('Budget created.')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(id).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Show the hand-over link and QR' })).toBeVisible()

  // the holder's side (§22.5 e): a fresh phone opens the link, sets a PIN once (two fields), adds it without a third
  await page.getByRole('button', { name: 'Show the hand-over link and QR' }).click()
  const link = await page.getByRole('textbox', { name: 'Hand-over link' }).inputValue()
  const phone = await browser.newContext({ viewport: { width: 375, height: 812 } })
  const holder = await phone.newPage()
  await holder.goto(new URL(link).pathname + new URL(link).hash)
  await expect(holder.getByRole('heading', { name: 'Set up your wallet' })).toBeVisible({ timeout: 90_000 })
  await expect(holder.getByText('Test network: practice money with no value')).toBeVisible()
  const pins = holder.locator('input[type="password"][inputmode="numeric"]')
  await expect(pins).toHaveCount(2)
  await pins.nth(0).fill('246810')
  await pins.nth(1).fill('246810')
  await holder.getByRole('button', { name: 'Create my wallet' }).click()
  await expect(holder.getByRole('heading', { name: 'A budget for you' })).toBeVisible()
  await expect(holder.getByLabel('Your PIN')).toHaveCount(0)
  await holder.getByRole('button', { name: 'Add to my wallet' }).click()
  await expect(holder.getByRole('heading', { name: 'Your budgets' })).toBeVisible({ timeout: 60_000 })
  await expect(holder.getByText('Test network: practice money with no value')).toBeVisible()
  await expect(holder.getByText(/can’t be cancelled early/)).toBeVisible()
  expect(await holder.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
  await phone.close()
  // the test wallet (a mock connector) may drop while the other browser runs: reconnect if it did
  const reconnect = page.getByRole('button', { name: 'Connect wallet' }).first()
  if (await reconnect.isVisible()) await reconnect.click()

  // confirmed: forgotten, and a reload starts fresh
  await page.getByRole('button', { name: 'I’ve handed it over' }).click()
  await expect(page.getByText('Budget created.')).toHaveCount(0)
  await page.reload()
  await page.getByRole('button', { name: 'Connect wallet' }).first().click({ timeout: 90_000 })
  await expect(page.getByText('Step 1 of 3')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText('Budget created.')).toHaveCount(0)
})
