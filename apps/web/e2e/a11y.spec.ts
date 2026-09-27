import AxeBuilder from '@axe-core/playwright'
import { expect, type Page, test } from '@playwright/test'

// BUILD_SPEC §22.5 h: WCAG 2.2 AA on the pages people use, in light and dark, at desktop and phone widths.
const TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

async function scan(page: Page, where: string) {
  const r = await new AxeBuilder({ page }).withTags(TAGS).analyze()
  const bad = r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
  const report = bad.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.nodes
        .map((n) => n.target.join(' '))
        .slice(0, 4)
        .join(' | ')}`,
  )
  expect(report, `${where}\n${report.join('\n')}`).toEqual([])
}

for (const scheme of ['light', 'dark'] as const)
  test(`no serious accessibility violations (${scheme})`, async ({ page }) => {
    test.setTimeout(300_000)
    await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
    for (const path of ['/', '/start', '/how-it-works', '/guarantees', '/docs/agents', '/shops', '/shop', '/wallet']) {
      await page.goto(path, { timeout: 120_000 })
      await page.waitForLoadState('networkidle')
      await scan(page, `${path} (${scheme})`)
    }
    // the account area, connected
    await page.goto('/app', { timeout: 120_000 })
    await page.getByRole('button', { name: 'Connect wallet' }).first().click({ timeout: 90_000 })
    await expect(page.getByRole('heading', { name: 'Your budgets' })).toBeVisible({ timeout: 90_000 })
    await scan(page, `/app (${scheme})`)
    for (const link of ['Budgets', 'Requests', 'Collect']) {
      await page
        .getByRole('navigation', { name: 'Account' })
        .getByRole('link', { name: new RegExp(link) })
        .click()
      await page.waitForLoadState('networkidle')
      await scan(page, `/app ${link} (${scheme})`)
    }
    await page.setViewportSize({ width: 375, height: 812 })
    await page.getByRole('navigation', { name: 'Account' }).getByRole('link', { name: 'Home' }).click()
    await scan(page, `/app at 375 px (${scheme})`)
  })
