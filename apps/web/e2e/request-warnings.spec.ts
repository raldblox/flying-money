import { getChain } from '@flying-money/chains'
import { encodeSpendRequest, signSpendRequest } from '@flying-money/core'
import { expect, test } from '@playwright/test'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

// A budget request from an agent key and a service the owner has never saved: the page warns like a bank flags a new
// payee, keeps the warning up through funding, and asks for an explicit "I've checked" before Approve.
test('an unknown agent asking to pay an unknown service is flagged, and needs an explicit check', async ({ page }) => {
  const owner = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' // anvil #1, the mock wallet
  const agent = privateKeyToAccount(generatePrivateKey())
  const payee = privateKeyToAccount(generatePrivateKey()).address
  const signed = await signSpendRequest(agent, getChain('anvil').chain.id, {
    owner,
    payee,
    amount: 2_000_000n,
    validFor: 86_400n,
    certificateId: `0x${'0'.repeat(64)}`,
    requestId: `0x${'ab'.repeat(32)}`,
    createdAt: BigInt(Math.floor(Date.now() / 1000)),
    reason: 'Weather data for the trip plan',
    origin: 'https://weather.example',
  })
  await page.goto(`/app/requests/new#${encodeSpendRequest(signed)}`)
  await page.getByRole('button', { name: 'Connect wallet' }).first().click({ timeout: 90_000 })
  const banner = page.getByText('Check before you pay: you haven’t saved this agent or this service')
  await expect(banner).toBeVisible({ timeout: 90_000 })
  const approve = page.getByRole('button', { name: 'Approve and fund…' })
  await expect(approve).toBeDisabled()
  await page.getByText('I asked my agent for this, and I’ve checked both addresses').click()
  await expect(approve).toBeEnabled()
  await approve.click()
  // the warning stays in view while funding
  await expect(page.getByRole('button', { name: /Approve 2 USDC/ })).toBeVisible({ timeout: 30_000 })
  await expect(banner).toBeVisible()
  if (process.env.E2E_SHOTS) {
    await page.setViewportSize({ width: 375, height: 812 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375)
    await page.screenshot({ path: 'test-results/shots/m-request-fund.png', fullPage: true })
  }
})
