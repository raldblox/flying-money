import { expect, test } from '@playwright/test'

test('theme follows the device, supports explicit choices and survives navigation and reload', async ({
  page,
  context,
}) => {
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' })
  await page.goto('/', { timeout: 120_000 })
  const theme = page.getByRole('combobox', { name: 'Color theme' })
  await expect(theme).toHaveValue('system')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await theme.selectOption('light')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  await page.reload()
  await expect(theme).toHaveValue('light')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  await page.emulateMedia({ colorScheme: 'light' })
  await theme.selectOption('dark')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await expect(page.getByRole('link', { name: 'Open app', exact: true })).toHaveCSS('color', 'rgb(239, 231, 216)')
  await page.screenshot({ path: '../../artifacts/demo-ux-review/theme-dark.png' })
  await page
    .getByRole('navigation', { name: 'Main' })
    .filter({ visible: true })
    .getByRole('link', { name: 'How it works' })
    .click()
  await expect(page).toHaveURL(/\/how-it-works$/)
  await expect(theme).toHaveValue('dark')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await page.goto('/wallet')
  await expect(theme).toHaveValue('dark')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await page.reload()
  await expect(theme).toHaveValue('dark')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  const other = await context.newPage()
  await other.goto('/')
  await expect(other.getByRole('combobox', { name: 'Color theme' })).toHaveValue('dark')
  await theme.selectOption('system')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  await expect(other.getByRole('combobox', { name: 'Color theme' })).toHaveValue('system')
  await other.close()
  await page.setViewportSize({ width: 320, height: 812 })
  await expect(theme).toBeVisible()
  await theme.selectOption('dark')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await theme.selectOption('light')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  await page.screenshot({ path: '../../artifacts/demo-ux-review/theme-mobile.png' })
})

test('theme changes still work when saving the preference fails', async ({ page }) => {
  await page.goto('/', { timeout: 120_000 })
  const theme = page.getByRole('combobox', { name: 'Color theme' })
  await expect(theme).toHaveValue('system')
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Storage full', 'QuotaExceededError')
    }
    Storage.prototype.removeItem = () => {
      throw new DOMException('Storage blocked', 'SecurityError')
    }
  })
  await theme.selectOption('dark')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'dark')
  await theme.selectOption('light')
  await expect(page.locator('html')).toHaveCSS('color-scheme', 'light')
  await theme.selectOption('system')
  await expect(page.locator('html')).not.toHaveAttribute('data-theme')
})
