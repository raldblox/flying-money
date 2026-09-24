import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import { privateKeyToAccount } from 'viem/accounts'

// §17 Sprint B: Playwright issue → redeem on anvil. The browser wallet is wagmi's mock connector (anvil #1).
const root = join(import.meta.dirname, '..')
const state = () => JSON.parse(readFileSync(join(root, '.e2e-state.json'), 'utf8')) as { spenderKey: `0x${string}` }
const sign = (id: string, cumulative: bigint) => {
  if (!/^0x[0-9a-f]{64}$/.test(id)) throw new Error('bad certificate id')
  return execSync(`pnpm -s e2e:anvil sign ${id} ${cumulative}`, { cwd: root }).toString().trim().split('\n').at(-1)!
}

test('issue a certificate, redeem a sealed note as the payee, and refuse the replay', async ({ page }) => {
  await page.goto('/app')
  await page.getByRole('button', { name: 'Connect wallet' }).click()
  await expect(page.getByRole('button', { name: 'Disconnect' })).toBeVisible()

  // Step 1: pay to our own address (payee may equal funder; only the spender must differ)
  const funder = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
  await page.getByText('Paste a payee address').click()
  await page.getByRole('textbox', { name: 'Payee address' }).fill(funder)
  await page.getByText('I checked this address twice').click()
  // Step 2: the spender is the e2e key (the test signs notes with it)
  const spender = privateKeyToAccount(state().spenderKey).address
  await page.getByRole('textbox', { name: 'Agent (spender) address' }).fill(spender)
  // Step 3: 5 USDC for 7 days (defaults)
  await page.getByRole('button', { name: /Approve 5 USDC/ }).click()
  await page.getByRole('button', { name: 'Issue certificate' }).click()
  await expect(page.getByText('Certificate issued.')).toBeVisible({ timeout: 60_000 })
  const id = (await page.locator('p.font-mono.break-all').first().textContent())!.trim()
  expect(id).toMatch(/^0x[0-9a-f]{64}$/)

  // Redeem 2.50 as the payee
  await page.getByRole('tab', { name: 'Certificates you can redeem' }).click()
  const card = page.locator('article', { hasText: id.slice(0, 6) })
  await expect(card).toBeVisible({ timeout: 30_000 })
  const note = sign(id, 2_500_000n)
  await card.getByRole('textbox').fill(note)
  await card.getByRole('button', { name: /Redeem/ }).click()
  await expect(card.getByText('Confirmed')).toBeVisible({ timeout: 60_000 })
  await expect(card).toContainText('2.50')

  // The same note again adds nothing: refused before any transaction
  await card.getByRole('textbox').fill(note)
  await expect(card.getByText(/Already redeemed/)).toBeVisible()
})
