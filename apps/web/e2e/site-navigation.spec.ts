import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test('homepage explains both roles and keeps deeper details accessible', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/', { timeout: 120_000 })
  await page.getByRole('link', { name: 'All three demos' }).click()
  const demos = page.getByRole('region', { name: 'Three ways to feel it work.' })
  await expect(demos).toBeInViewport()
  await expect(demos.getByRole('link', { name: 'Enter the shop' })).toHaveAttribute('href', '/demo/counter')
  await expect(demos.getByRole('link', { name: 'Meet the agent' })).toHaveAttribute('href', '/demo')
  await expect(demos.getByRole('link', { name: 'Get a slip' })).toHaveAttribute('href', '/demo/slip')
  await expect(demos).toContainText('Claim a test budget')
  await expect(demos).toContainText('Review the agent’s shopping list')
  const sdk = page.locator('details').filter({ hasText: 'See the SDK and MCP examples' })
  await expect(sdk).not.toHaveAttribute('open')
  await sdk.locator('summary').click()
  await expect(sdk.getByRole('tab', { name: 'Pay (agent)' })).toBeVisible()
  await sdk.locator('summary').click()
  await page.screenshot({ path: '../../artifacts/demo-ux-review/homepage-desktop.png', fullPage: true })
  const footer = page.getByRole('navigation', { name: 'Footer' })
  for (const label of ['Shop demo', 'Agent demo', 'Promises and limits', 'Agent quickstart', 'Seller quickstart'])
    await expect(footer.getByRole('link', { name: label, exact: true })).toBeVisible()
})

test('navigation fits narrow phones through desktop and supports keyboard dismissal', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/', { timeout: 120_000 })
  for (const width of [320, 360, 390, 768, 1024, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    await expect(page.getByRole('link', { name: 'Flying Money home' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`).toBe(
      true,
    )
    if (width < 1024) {
      const toggle = page.getByRole('button', { name: 'Open menu' })
      await toggle.click()
      const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true })
      await expect(nav.getByRole('link', { name: 'Shop demo · be the visitor' })).toBeVisible()
      await page.keyboard.press('Tab')
      await expect(nav.getByRole('link', { name: 'Try the demos' })).toBeFocused()
      await page.keyboard.press('Escape')
      await expect(toggle).toBeFocused()
      await expect(nav).toHaveCount(0)
    } else {
      await expect(page.getByRole('button', { name: 'Open menu' })).toBeHidden()
      const nav = page.getByRole('navigation', { name: 'Main' }).filter({ visible: true })
      const brand = await page.getByRole('link', { name: 'Flying Money home' }).boundingBox()
      const bounds = await nav.boundingBox()
      expect(brand && bounds && brand.x + brand.width <= bounds.x).toBe(true)
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: '../../artifacts/demo-ux-review/homepage-mobile.png', fullPage: true })
  await page.getByRole('button', { name: 'Open menu' }).click()
  await page.screenshot({ path: '../../artifacts/demo-ux-review/homepage-menu.png' })
  const result = await new AxeBuilder({ page }).analyze()
  expect(result.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')).toEqual([])
  await page
    .getByRole('navigation', { name: 'Main' })
    .filter({ visible: true })
    .getByRole('link', { name: 'Agent demo · approve its plan' })
    .click()
  await expect(page).toHaveURL(/\/demo$/)
  await expect(page.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false')
})
