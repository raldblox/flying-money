import { getChain } from '@flying-money/chains'
import {
  grantTypedData,
  newRequestId,
  type RequestGrant,
  signSpendRequest,
  spendRequestToParts,
  ZERO_ID,
} from '@flying-money/core'
import { expect, test } from '@playwright/test'
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'

// §21.4.2 relay inbox, end to end in the browser on anvil: the owner's grant lets an agent post a request; the owner
// signs in to the inbox (a signature, not a transaction), sees it waiting, funds it from the wallet, and the inbox
// marks it approved only after checking the funding transaction on-chain (R2).
// Anvil account #1 is a PUBLIC test account (the well-known dev mnemonic); it is the e2e wallet.
const owner = mnemonicToAccount('test test test test test test test test test test test junk', { addressIndex: 1 })

test('an agent asks through the inbox; the owner sees it, funds it, and the inbox records it as approved', async ({
  page,
  request,
}) => {
  const chainId = getChain('anvil').chain.id
  const agent = privateKeyToAccount(generatePrivateKey())
  const payee = privateKeyToAccount(generatePrivateKey()).address
  const g: RequestGrant = {
    owner: owner.address,
    requester: agent.address,
    maxAmountPerRequest: 5_000_000n,
    expiresAt: BigInt(Math.floor(Date.now() / 1000) + 30 * 86_400),
    grantId: newRequestId(),
  }
  const grantSig = await owner.signTypedData(grantTypedData(chainId, g))
  const signed = await signSpendRequest(agent, chainId, {
    owner: owner.address,
    payee,
    amount: 2_000_000n,
    validFor: 86_400n,
    certificateId: ZERO_ID,
    requestId: newRequestId(),
    createdAt: BigInt(Math.floor(Date.now() / 1000)),
    reason: 'Weather lookups for the trip plan',
    origin: 'https://weather.example',
  })
  const parts = spendRequestToParts(signed)
  const body = {
    chainId: parts.chainId,
    request: parts.request,
    sig: parts.sig,
    grant: {
      owner: g.owner,
      requester: g.requester,
      maxAmountPerRequest: g.maxAmountPerRequest.toString(),
      expiresAt: g.expiresAt.toString(),
      grantId: g.grantId,
    },
    grantSig,
  }
  // the agent posts (first request to the route compiles it in dev)
  const posted = await request.post('/api/requests', { data: body, timeout: 90_000 })
  expect(posted.status()).toBe(201)
  // without a grant it is refused
  expect((await request.post('/api/requests', { data: { ...body, grant: undefined } })).status()).toBe(400)
  // nobody can read the inbox without the owner's session
  expect((await request.get('/api/requests')).status()).toBe(401)

  await page.goto('/app/requests')
  await page.getByRole('button', { name: 'Connect wallet' }).first().click({ timeout: 90_000 })
  await page.getByRole('button', { name: 'Sign in with wallet' }).click({ timeout: 90_000 })
  await expect(page.getByRole('heading', { name: /Waiting for you/ })).toBeVisible({ timeout: 30_000 })
  const row = page.getByRole('link', { name: /2\.00 USDC/ })
  await expect(row).toBeVisible()
  await expect(page.getByText('1 waiting')).toBeAttached() // the nav badge
  await row.click()

  // the review card, from the inbox: unknown agent and service, so the double check applies
  await expect(page.getByText('Check before you pay')).toBeVisible({ timeout: 90_000 })
  await page.getByText('I asked my agent for this, and I’ve checked both addresses').click()
  await expect(page.getByRole('button', { name: 'Approve a smaller budget' })).toBeVisible()
  await page.getByRole('button', { name: 'Approve and fund…' }).click()
  await page.getByRole('button', { name: /Approve 2.00 USDC/ }).click()
  await page.getByRole('button', { name: /Fund the budget/ }).click({ timeout: 60_000 })
  await expect(page.getByText('Approved. The budget is locked.')).toBeVisible({ timeout: 60_000 })

  // the inbox verified the funding on-chain before recording it (R2)
  await expect
    .poll(async () => (await (await request.get(`/api/requests/${signed.request.requestId}`)).json()).status, {
      timeout: 30_000,
    })
    .toBe('approved')
  await page
    .getByRole('navigation', { name: 'Account' })
    .getByRole('link', { name: /Requests/ })
    .click()
  await expect(page.getByRole('heading', { name: 'Answered' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Funded').first()).toBeVisible()

  // §22.5 g: a top-up request for that budget, approved from the inbox, recorded only after the on-chain top-up (A4)
  const certificateId = (await (await request.get(`/api/requests/${signed.request.requestId}`)).json()).certificateId
  const topUp = await signSpendRequest(agent, chainId, {
    owner: owner.address,
    payee,
    amount: 1_000_000n,
    validFor: 86_400n,
    certificateId,
    requestId: newRequestId(),
    createdAt: BigInt(Math.floor(Date.now() / 1000)),
    reason: 'A few more lookups',
    origin: 'https://weather.example',
  })
  const tp = spendRequestToParts(topUp)
  expect((await request.post('/api/requests', { data: { ...body, request: tp.request, sig: tp.sig } })).status()).toBe(
    201,
  )
  await page
    .getByRole('navigation', { name: 'Account' })
    .getByRole('link', { name: /Requests/ })
    .click()
  // already on this page: coming back to the window re-reads the inbox
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await page.getByRole('link', { name: /1\.00 USDC/ }).click({ timeout: 30_000 })
  await expect(page.getByText(/asks you to add/)).toBeVisible({ timeout: 90_000 })
  await page.getByRole('button', { name: /Approve 1\.00 USDC/ }).click()
  await page.getByRole('button', { name: /Add 1\.00 USDC/ }).click({ timeout: 60_000 })
  await expect(page.getByText(/Added\. Your agent finds/)).toBeVisible({ timeout: 60_000 })
  await expect
    .poll(async () => (await (await request.get(`/api/requests/${topUp.request.requestId}`)).json()).status, {
      timeout: 30_000,
    })
    .toBe('approved')
})
