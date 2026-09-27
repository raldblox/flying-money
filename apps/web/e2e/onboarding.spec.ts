import { expect, test } from '@playwright/test'

// BUILD_SPEC §22.10: one start page, one message connects an assistant, an empty wallet explains itself, and a shop
// opens a till in three steps and hands customers a "get a budget for this shop" link (unverified when opened).
const OWNER = '0x8dB423F3b8991865030BcE381F7A50EC517c7c50'
const SHOP = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'

test('start page offers four paths', async ({ page }) => {
  await page.goto('/start', { timeout: 120_000 })
  for (const [name, href] of [
    ['Give someone a budget', '/app/give?for=person'],
    ['Let my AI assistant pay', '/app/connect'],
    ['Use a budget I was given', '/wallet'],
    ['Take payments at my shop', '/shop'],
  ] as const)
    await expect(page.getByRole('link', { name: new RegExp(name) })).toHaveAttribute('href', href)
  await page.goto('/')
  await expect(page.getByRole('link', { name: /Get started/ }).first()).toHaveAttribute('href', '/start')
})

test('an assistant connects with one message', async ({ page, request }) => {
  const md = await (await request.get('/agent.md')).text()
  expect(md).toContain('fm_status')
  expect(md).toContain('fm_request_budget')
  await page.goto('/app/connect', { timeout: 120_000 })
  await page.getByLabel('Your wallet address').fill(OWNER)
  await expect(page.getByTestId('agent-instruction')).toContainText('/agent.md and follow it.')
  await expect(page.getByTestId('agent-instruction')).toContainText(`My wallet is ${OWNER}.`)
})

test('an empty wallet explains itself before asking for a PIN', async ({ page }) => {
  await page.goto('/wallet', { timeout: 120_000 })
  await expect(page.getByRole('heading', { name: 'Your wallet for budgets' })).toBeVisible({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Set up my wallet' }).click()
  await expect(page.getByRole('heading', { name: 'Set up your wallet' })).toBeVisible()
})

test('a shop opens a till in three steps and shares a budget link', async ({ page }) => {
  await page.goto('/shop', { timeout: 120_000 })
  await expect(page.getByLabel('Shop name')).toHaveValue('')
  await page.getByLabel('Shop name').fill('Corner Tea')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Or paste the address').fill(SHOP)
  await page.getByRole('button', { name: 'Open my till' }).click()
  await expect(page.getByRole('heading', { name: 'Corner Tea’s till is ready' })).toBeVisible()
  await expect(page.getByRole('link', { name: /Open the till/ })).toHaveAttribute('href', /\/pos\?name=Corner/)
  await expect(page.getByRole('img', { name: 'Get a budget for Corner Tea' })).toBeVisible()
  const link = (await page.locator('p.break-all').textContent()) ?? ''
  expect(link).toContain(`seller=${SHOP}`)

  // remembered on this device
  await page.goto('/shop')
  await expect(page.getByRole('heading', { name: 'Your tills' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Remove Corner Tea' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open till' })).toHaveAttribute('href', /\/pos\?name=Corner/)

  // the customer's side: the seller is pre-filled and marked unverified
  await page.goto(link)
  const connect = page.getByRole('button', { name: 'Connect wallet' }).first()
  if (await connect.isVisible({ timeout: 60_000 }).catch(() => false)) await connect.click()
  await expect(page.getByText('This link names a shop: Corner Tea. We can’t check who shared it.')).toBeVisible({
    timeout: 90_000,
  })
  await expect(page.getByRole('radio', { name: /Corner Tea \(from a link\).*unverified/ })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: /I checked this address twice with Corner Tea/ })).not.toBeChecked()
})
