import { readFileSync } from 'node:fs'
import { flyingMoneyAbi } from '@flying-money/abi'
import { type LiveEvent, runLiveDemo } from '@flying-money/agent'
import { anvilAccount } from '@flying-money/agent/anvil'
import { getChain, setLocalDeployment } from '@flying-money/chains'
import { decodeNote, type Hex } from '@flying-money/core'
import { expect, test } from '@playwright/test'
import { createPublicClient, createWalletClient, erc20Abi, http } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { handOverFragment } from '../lib/handover'
import { SITE } from '../lib/site'

test('approved agent delivers its real local purchases, keepsake and collection record', async ({ page }) => {
  const local = JSON.parse(readFileSync(new URL('../.e2e-state.json', import.meta.url), 'utf8')) as {
    spenderKey: Hex
    usdc: Hex
    flyingMoney: Hex
  }
  setLocalDeployment({ usdc: local.usdc, flyingMoney: local.flyingMoney })
  let requests = 0
  let savedEvents: unknown[] = []
  await page.route('**/api/demo/run**', async (route) => {
    if (route.request().method() === 'GET') {
      const recovery = new URL(route.request().url()).searchParams.has('runId')
      return route.fulfill({
        json: recovery
          ? { events: savedEvents, status: 'done', createdAt: Date.now() }
          : { available: true, message: 'Sponsorship is available.' },
      })
    }
    requests++
    const events: Array<LiveEvent | Record<string, string>> = [
      { type: 'start', chain: 'anvil', chainName: 'Local test network', face: '300000', explorer: '' },
    ]
    await runLiveDemo({
      chain: 'anvil',
      funder: anvilAccount(1),
      agent: privateKeyToAccount(local.spenderKey),
      redeemer: anvilAccount(2),
      payee: anvilAccount(3).address,
      faceValue: 300_000n,
      transport: 'in-process',
      onEvent: (e) => events.push(e),
      fetchWeather: async () => ({ temperature_c: 24, wind_kmh: 6, time: '2026-10-09T00:00' }),
    })
    savedEvents = events
    await route.fulfill({ json: { runId: route.request().postDataJSON().runId } })
  })
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Approve these purchases', exact: true }).click()
  await expect(page.getByText('19 of 19 approved purchases delivered.')).toBeVisible({ timeout: 90_000 })
  await expect(page.getByRole('heading', { name: 'Tea-price comparison' })).toBeVisible()
  await expect(page.getByRole('img', { name: /Your 飛錢 certificate/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Save as image' })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Payment record' })).toContainText('0.25 USDC')
  expect(requests).toBe(1)
  await page.screenshot({ path: '../../artifacts/demo-ux-review/implemented-agent-result.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '../../artifacts/demo-ux-review/implemented-agent-mobile.png', fullPage: true })
})

test('the agent waits for approval, respects decline, and preserves a partial run', async ({ page }) => {
  let requests = 0
  await page.route('**/api/demo/run**', async (route) => {
    if (route.request().method() === 'POST') {
      requests++
      return route.fulfill({ json: { runId: route.request().postDataJSON().runId } })
    }
    if (!new URL(route.request().url()).searchParams.has('runId'))
      return route.fulfill({ json: { available: true, message: 'Sponsorship is available.' } })
    await route.fulfill({
      json: {
        status: 'interrupted',
        createdAt: Date.now(),
        events: [
          { type: 'start', chain: 'anvil', chainName: 'Local test network', face: '300000', explorer: '' },
          {
            type: 'answer',
            step: 'asked tea price @Dunhuang',
            path: '/v1/tea-price?city=Dunhuang',
            status: 200,
            body: { city: 'Dunhuang', pricePerJin: 80, trend: 'steady' },
          },
          {
            type: 'answer',
            step: 'asked weather @Dunhuang',
            path: '/v1/weather?lat=40&lon=94',
            status: 503,
            body: null,
          },
        ],
      },
    })
  })
  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: 'May I shop at the Oracle for you?' })).toBeVisible()
  expect(requests).toBe(0)
  await page.getByRole('button', { name: 'Not now', exact: true }).click()
  await expect(page.getByText('Not now. No purchases have been started.')).toBeVisible()
  expect(requests).toBe(0)
  await page.getByRole('button', { name: 'Approve these purchases', exact: true }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'This run needs attention' })).toContainText(
    'runner stopped reporting',
  )
  await expect(page.getByRole('heading', { name: 'Check your saved run' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Your Silk Road briefing' })).toBeVisible()
  await page.getByText(/Explore all purchased answers/).click()
  await expect(page.getByText('80 per jin · steady')).toBeVisible()
  await expect(page.getByText(/unavailable \(HTTP 503\)/)).toBeVisible()
  expect(requests).toBe(1)
})

test('illustration is opt-in and can be paused without starting a purchase', async ({ page }) => {
  let requests = 0
  page.on('request', (r) => {
    if (r.url().endsWith('/api/demo/run')) requests++
  })
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Watch an illustration' }).click()
  await page.getByRole('button', { name: 'Pause illustration' }).click()
  await expect(page.getByRole('button', { name: 'Resume illustration' })).toBeVisible()
  await page.getByRole('button', { name: 'Close illustration' }).click()
  expect(requests).toBe(0)
})

test('counter claims a budget, signs, resumes after refresh, pays offline and collects locally', async ({ page }) => {
  // All funds and transactions in this test are on the private anvil. The transport endpoints are intercepted;
  // signing, seller verification, persistence and contract settlement remain real.
  const local = JSON.parse(readFileSync(new URL('../.e2e-state.json', import.meta.url), 'utf8')) as {
    spenderKey: Hex
    usdc: Hex
    flyingMoney: Hex
  }
  const chain = getChain('anvil').chain
  const pub = createPublicClient({ chain, transport: http(), pollingInterval: 50 })
  const owner = anvilAccount(1)
  const wallet = createWalletClient({ account: owner, chain, transport: http() })
  const wait = (hash: Hex) => pub.waitForTransactionReceipt({ hash })
  await wait(
    await wallet.writeContract({
      address: local.usdc,
      abi: erc20Abi,
      functionName: 'approve',
      args: [local.flyingMoney, 150_000n],
    }),
  )
  let claims = 0
  await page.route('**/api/demo/counter?**', (route) =>
    route.fulfill({ json: { available: true, message: 'Your sponsored budget is available.' } }),
  )
  await page.route('**/api/demo/counter', async (route) => {
    claims++
    const budgets = []
    for (const [role, name, payee, face] of [
      ['shop', 'Tea House', owner.address, 100_000n],
      ['tips', 'Tips for Mei', SITE.demoStaff, 50_000n],
    ] as const) {
      const expiry = (await pub.getBlock()).timestamp + 3n * 86400n
      const { request, result: id } = await pub.simulateContract({
        address: local.flyingMoney,
        abi: flyingMoneyAbi,
        functionName: 'issue',
        account: owner,
        args: [payee, privateKeyToAccount(local.spenderKey).address, face, expiry],
      })
      const hash = await wallet.writeContract(request)
      expect((await wait(hash)).status).toBe('success')
      budgets.push({
        role,
        name,
        payee,
        face: String(face),
        expiresAt: String(expiry),
        certificateId: id,
        issueTx: `#${hash}`,
        handOver: handOverFragment({ v: 1, chain: 'anvil', id, key: local.spenderKey, name }),
      })
    }
    await route.fulfill({ json: { contract: local.flyingMoney, budgets } })
  })
  await page.route('**/api/demo/counter/collect', async (route) => {
    const data = route.request().postDataJSON() as { notes: string[] }
    const items = data.notes.map((raw) => {
      const n = decodeNote(raw)
      return { certificateId: n.certificateId, cumulative: n.cumulative, memo: n.memo, signature: n.sig }
    })
    const hash = await wallet.writeContract({
      address: local.flyingMoney,
      abi: flyingMoneyAbi,
      functionName: 'redeemMany',
      args: [items],
    })
    expect((await wait(hash)).status).toBe('success')
    await route.fulfill({ json: { hash, tx: `#${hash}`, collected: items.length } })
  })
  await page.goto('/demo/counter')
  await expect(page.getByText(/Temporary spending keys/)).toBeVisible()
  await page.screenshot({ path: '../../artifacts/demo-ux-review/implemented-counter-onboarding.png', fullPage: true })
  await page.getByRole('button', { name: 'Set up wallet & claim demo budget' }).click()
  await expect(page.getByText(/Your budgets are ready/)).toBeVisible({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Green tea 0.01 USDC' }).click()
  await page.getByRole('button', { name: 'Review purchase · 0.01 USDC' }).click()
  await page.getByRole('button', { name: 'Sign & pay 0.01 USDC' }).click()
  await expect(page.getByRole('region', { name: 'Your latest receipt' })).toContainText('Awaiting seller collection')
  await expect(
    page.getByRole('list', { name: 'Your demo journey' }).getByRole('listitem').filter({ hasText: 'Try offline' }),
  ).not.toContainText('completed')
  await page.reload()
  await expect(page.getByRole('region', { name: 'Your latest receipt' })).toContainText('Green tea')
  expect(claims).toBe(1)
  await page.getByRole('button', { name: 'Collect 0.01 USDC' }).click()
  await expect(page.getByRole('region', { name: 'Your latest receipt' })).toContainText('Collected on-chain')
  await expect(
    page.getByRole('list', { name: 'Your demo journey' }).getByRole('listitem').filter({ hasText: 'Try offline' }),
  ).not.toContainText('completed')
  await expect(page.getByRole('region', { name: 'What you experienced' })).toContainText(
    'offline experiment is still available',
  )
  await page.getByRole('button', { name: 'Try offline payment' }).click()
  await page.getByRole('button', { name: 'Flying Money keepsake 0.01 USDC' }).click()
  await page.getByRole('button', { name: 'Review purchase · 0.01 USDC' }).click()
  await page.getByRole('button', { name: 'Sign & pay 0.01 USDC' }).click()
  await expect(page.getByRole('button', { name: 'Open & save your keepsake' })).toBeVisible()
  await page.getByRole('button', { name: 'Reconnect the till', exact: true }).click()
  await page.getByRole('button', { name: 'Collect 0.01 USDC' }).click()
  await expect(page.getByRole('region', { name: 'Your latest receipt' })).toContainText('Collected on-chain')
  await expect(page.getByRole('button', { name: 'Everything collected' })).toBeDisabled()
  await expect(page.getByRole('region', { name: 'What you experienced' })).toContainText(
    'You also paid while the till could not reach the blockchain.',
  )
  await expect(
    page.getByRole('list', { name: 'Your demo journey' }).getByRole('listitem').filter({ hasText: 'Try offline' }),
  ).toContainText('completed')
  await page.screenshot({ path: '../../artifacts/demo-ux-review/implemented-counter-result.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '../../artifacts/demo-ux-review/implemented-counter-mobile.png', fullPage: true })
})

test('refresh reconnects to the same agent run without purchasing again', async ({ page }) => {
  let purchases = 0
  let finished = false
  await page.route('**/api/demo/run**', async (route) => {
    if (route.request().method() === 'POST') {
      purchases++
      return route.fulfill({ json: { runId: route.request().postDataJSON().runId } })
    }
    if (!new URL(route.request().url()).searchParams.has('runId'))
      return route.fulfill({ json: { available: true, message: 'Sponsorship is available.' } })
    await route.fulfill({
      json: {
        createdAt: Date.now(),
        status: finished ? 'error' : 'running',
        events: finished
          ? [{ type: 'error', message: 'Example stopped run; evidence retained.' }]
          : [{ type: 'start', chain: 'anvil', chainName: 'Local test network', face: '300000', explorer: '' }],
      },
    })
  })
  await page.goto('/demo')
  await page.getByRole('button', { name: 'Approve these purchases', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Agent progress' })).toContainText('Preparing your sponsored budget')
  finished = true
  await page.reload()
  await expect(page.getByRole('alert').filter({ hasText: 'This run needs attention' })).toContainText(
    'Example stopped run',
  )
  expect(purchases).toBe(1)
  await page.getByRole('button', { name: 'Reconnect to this run' }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'This run needs attention' })).toBeVisible()
  expect(purchases).toBe(1)
})

test('unavailable sponsorship explains the reason and offers an illustration without purchase', async ({ page }) => {
  let purchases = 0
  await page.route('**/api/demo/run**', async (route) => {
    if (route.request().method() === 'POST') purchases++
    await route.fulfill({
      json: {
        available: false,
        reason: 'exhausted',
        message: 'Today’s sponsored demo budget is used up. It resets at midnight UTC.',
      },
    })
  })
  await page.goto('/demo')
  await expect(page.getByText(/Today’s sponsored demo budget is used up/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve these purchases', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Watch an illustration' }).click()
  await expect(page.getByRole('button', { name: 'Pause illustration' })).toBeVisible()
  expect(purchases).toBe(0)
})

test('counter explains unavailable sponsorship before claiming a wallet', async ({ page }) => {
  let claims = 0
  await page.route('**/api/demo/counter**', async (route) => {
    if (route.request().method() === 'POST') claims++
    await route.fulfill({
      json: {
        available: false,
        reason: 'busy',
        message: 'Another visitor’s budget is being funded. Check again shortly.',
      },
    })
  })
  await page.goto('/demo/counter')
  await expect(page.getByText('Another visitor’s budget is being funded. Check again shortly.')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Set up wallet & claim demo budget' })).toBeDisabled()
  await expect(page.getByRole('link', { name: 'Watch the payment illustration' })).toBeVisible()
  await page.getByRole('button', { name: 'Check availability again' }).click()
  await expect(page.getByText('Another visitor’s budget is being funded. Check again shortly.')).toBeVisible()
  expect(claims).toBe(0)
})
