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

test('the production worker recovers saved tills after the till page is closed', async ({ page, context }) => {
  await page.goto('/wallet')
  await expect(page.getByText('this page is saved for offline use', { exact: false })).toBeVisible({ timeout: 60_000 })
  await page.evaluate(async () => {
    const request = indexedDB.open('fm-runtime', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('kv')
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite')
      tx.objectStore('kv').put(
        JSON.stringify({ v: 1, chain: 'arbitrum-sepolia', payee: `0x${'11'.repeat(20)}` }),
        `till:arbitrum-sepolia:0x${'11'.repeat(20)}`,
      )
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  })
  const host = await context.newPage()
  await host.goto('/')
  await page.close()
  const result = await host.evaluate(async () => {
    const worker = (await navigator.serviceWorker.ready).active!
    return new Promise<{ ok: boolean; checked: number }>((resolve, reject) => {
      const channel = new MessageChannel()
      const timeout = setTimeout(() => reject(new Error('Worker recovery timed out')), 30_000)
      channel.port1.onmessage = (event) => {
        clearTimeout(timeout)
        channel.port1.close()
        resolve(event.data)
      }
      worker.postMessage({ type: 'RECOVER_SAVED_PAYMENTS' }, [channel.port2])
    })
  })
  expect(result).toMatchObject({ ok: true, checked: 1 })
})
