import { flyingMoneyAbi, flyingMoneyBytecode, mockUsdcAbi, mockUsdcBytecode } from '@flying-money/abi'
import { secp256k1 } from '@noble/curves/secp256k1'
import {
  createPublicClient,
  createWalletClient,
  encodeAbiParameters,
  getAddress,
  type Hex,
  http,
  keccak256,
  toHex,
} from 'viem'
import { generatePrivateKey, mnemonicToAccount, privateKeyToAccount } from 'viem/accounts'
import { anvil as anvilChain } from 'viem/chains'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import {
  certificateId,
  decodeNote,
  decodeOffer,
  decodeReceipt,
  domain,
  encodeHeader,
  hashNote,
  MAX_HEADER_BYTES,
  newRequestId,
  noteTypes,
  type Offer,
  type Receipt,
  type SignedNote,
  signNote,
  verifyNoteSignature,
} from '../src/index.js'
import { ANVIL_MNEMONIC, anvilAvailable, startAnvil } from './anvil.js'

const CONTRACT: Hex = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512'
const spender = privateKeyToAccount(generatePrivateKey())
const other = privateKeyToAccount(generatePrivateKey())
const cid = keccak256(toHex('cert'))

const b64url = (s: string) => Buffer.from(s, 'utf8').toString('base64url')
const unwrap = (h: string) => JSON.parse(Buffer.from(h.slice(4), 'base64url').toString('utf8'))

describe('EIP-712 (§6.3)', () => {
  it('domain and types are exactly the spec', () => {
    expect(domain(421614, CONTRACT)).toEqual({
      name: 'FlyingMoney',
      version: '1',
      chainId: 421614,
      verifyingContract: CONTRACT,
    })
    expect(noteTypes).toEqual({
      Note: [
        { name: 'certificateId', type: 'bytes32' },
        { name: 'cumulative', type: 'uint256' },
        { name: 'memo', type: 'bytes32' },
      ],
    })
  })

  it('certificateId = keccak256(abi.encode(chainId, contract, funder, nonce))', () => {
    const funder: Hex = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
    const expected = keccak256(
      encodeAbiParameters(
        [{ type: 'uint256' }, { type: 'address' }, { type: 'address' }, { type: 'uint256' }],
        [31337n, CONTRACT, funder, 7n],
      ),
    )
    expect(certificateId(31337, CONTRACT, funder, 7n)).toBe(expected)
  })

  it('sign → verify (pure ECDSA, offline); other signers, domains and tampering fail', async () => {
    const note = { certificateId: cid, cumulative: 370_000n, memo: newRequestId() }
    const signed = await signNote(spender, 421614, CONTRACT, note)
    expect(signed).toMatchObject({ ...note, chainId: 421614, contract: CONTRACT })
    expect(verifyNoteSignature(signed, spender.address)).toBe(true)
    expect(verifyNoteSignature(signed, other.address)).toBe(false)
    expect(verifyNoteSignature({ ...signed, cumulative: 370_001n }, spender.address)).toBe(false)
    expect(verifyNoteSignature({ ...signed, memo: newRequestId() }, spender.address)).toBe(false)
    expect(verifyNoteSignature({ ...signed, chainId: 1 }, spender.address)).toBe(false)
    expect(verifyNoteSignature({ ...signed, contract: other.address }, spender.address)).toBe(false)
    expect(verifyNoteSignature({ ...signed, sig: '0x1234' }, spender.address)).toBe(false)
  })

  it('rejects the high-s malleated twin (OZ ECDSA parity)', async () => {
    const signed = await signNote(spender, 1, CONTRACT, { certificateId: cid, cumulative: 1n, memo: newRequestId() })
    const r = signed.sig.slice(2, 66)
    const s = BigInt(`0x${signed.sig.slice(66, 130)}`)
    const v = Number.parseInt(signed.sig.slice(130, 132), 16)
    const highS = (secp256k1.CURVE.n - s).toString(16).padStart(64, '0')
    const mall = `0x${r}${highS}${(v === 27 ? 28 : 27).toString(16)}` as Hex
    expect(verifyNoteSignature({ ...signed, sig: mall }, spender.address)).toBe(false)
  })

  it('newRequestId is 32 random bytes', () => {
    const a = newRequestId()
    expect(a).toMatch(/^0x[0-9a-f]{64}$/)
    expect(newRequestId()).not.toBe(a)
  })
})

describe('wire format (§6.4, §8.1 parsing rules, D4)', () => {
  const note = (): Promise<SignedNote> =>
    signNote(spender, 10143, CONTRACT, { certificateId: cid, cumulative: 370_000n, memo: newRequestId() })

  it('note round-trips with decimal-string chainId and cumulative', async () => {
    const n = await note()
    const h = encodeHeader(n)
    expect(h.startsWith('fm1.')).toBe(true)
    expect(unwrap(h)).toEqual({
      v: 1,
      chainId: '10143',
      contract: CONTRACT,
      certificateId: cid,
      cumulative: '370000',
      memo: n.memo,
      sig: n.sig,
    })
    expect(decodeNote(h)).toEqual(n)
  })

  it('offer round-trips (v and minRemainingLifetime are numbers; the rest decimal strings)', () => {
    const offer: Offer = {
      scheme: 'flying-money',
      v: 1,
      price: 10_000n,
      minRemainingLifetime: 3600,
      suggestedFaceValue: 5_000_000n,
      accepts: [{ chainId: 421614, contract: CONTRACT, token: other.address, payee: spender.address }],
      docs: 'https://example.invalid/docs',
    }
    const h = encodeHeader(offer)
    const json = unwrap(h)
    expect(json.price).toBe('10000')
    expect(json.minRemainingLifetime).toBe(3600)
    expect(json.accepts[0].chainId).toBe('421614')
    expect(decodeOffer(h)).toEqual(offer)
    expect(decodeOffer(encodeHeader({ ...offer, memoHint: 'order-7', suggestedFaceValue: undefined }))).toEqual({
      ...offer,
      memoHint: 'order-7',
      suggestedFaceValue: undefined,
    })
  })

  it('receipt round-trips (expiresAt as decimal string)', () => {
    const r: Receipt = {
      certificateId: cid,
      requestId: newRequestId(),
      status: 'SERVED',
      accepted: 370_000n,
      consumed: 360_000n,
      reserved: 0n,
      credit: 10_000n,
      remaining: 4_630_000n,
      expiresAt: 1_790_000_000n,
    }
    const h = encodeHeader(r)
    expect(unwrap(h).expiresAt).toBe('1790000000')
    expect(decodeReceipt(h)).toEqual(r)
  })

  it('strict parser rejects malformed input', async () => {
    const n = await note()
    const good = unwrap(encodeHeader(n))
    const enc = (o: unknown) => `fm1.${b64url(JSON.stringify(o))}`
    const { memo: _drop, ...missing } = good
    const bad: unknown[] = [
      { ...good, extra: 1 },
      { ...good, v: 2 },
      { ...good, v: '1' },
      { ...good, cumulative: '01' },
      { ...good, cumulative: '-1' },
      { ...good, cumulative: '1.5' },
      { ...good, cumulative: 370000 },
      { ...good, cumulative: '1e6' },
      { ...good, cumulative: (2n ** 256n).toString() },
      { ...good, chainId: '0' },
      { ...good, chainId: 10143 },
      { ...good, memo: '0x1234' },
      { ...good, certificateId: `${good.certificateId}00` },
      { ...good, contract: '0x1234' },
      { ...good, sig: `${good.sig}00` },
      { ...good, sig: 'nothex' },
      missing,
      [good],
      'string',
      null,
    ]
    for (const b of bad) expect(() => decodeNote(enc(b)), JSON.stringify(b)).toThrow()
    expect(() => decodeNote(`fm2.${b64url(JSON.stringify(good))}`)).toThrow()
    expect(() => decodeNote('fm1.!!!')).toThrow()
    expect(() => decodeNote(`fm1.${b64url(JSON.stringify({ ...good, pad: 'x'.repeat(MAX_HEADER_BYTES) }))}`)).toThrow()
    expect(() => decodeNote(`fm1.${b64url(`${JSON.stringify(good)}x`)}`)).toThrow()
    expect(MAX_HEADER_BYTES).toBe(2048)
  })

  it('a signed note header fits one QR code at error-correction level M (§6.8, D13)', async () => {
    // QR version 18-M holds 593 bytes in byte mode; the fm1 note is ~544 chars (the spec's "about 350" was an estimate).
    expect(encodeHeader(await note()).length).toBeLessThanOrEqual(593)
  })
})

describe.runIf(anvilAvailable)('TS ↔ Solidity parity on anvil (§7.4)', () => {
  let stop = () => {}
  let url = ''
  beforeAll(async () => {
    ;({ url, stop } = await startAnvil())
  }, 30_000)
  afterAll(() => stop())

  it('noteDigest == hashNote for 100 random inputs; certificateId matches issue(); TS notes redeem', async () => {
    const deployer = mnemonicToAccount(ANVIL_MNEMONIC, { addressIndex: 0 })
    const wallet = createWalletClient({ account: deployer, chain: anvilChain, transport: http(url) })
    const pub = createPublicClient({ chain: anvilChain, transport: http(url) })
    const wait = async (hash: Hex) => pub.waitForTransactionReceipt({ hash })
    const usdc = (await wait(await wallet.deployContract({ abi: mockUsdcAbi, bytecode: mockUsdcBytecode })))
      .contractAddress!
    const fm = (
      await wait(
        await wallet.deployContract({ abi: flyingMoneyAbi, bytecode: flyingMoneyBytecode, args: [usdc, 0n, 0n] }),
      )
    ).contractAddress!
    const fmAddr = getAddress(fm)

    const [, name, version, chainId, verifyingContract] = await pub.readContract({
      address: fm,
      abi: flyingMoneyAbi,
      functionName: 'eip712Domain',
    })
    expect({ name, version, chainId: Number(chainId), verifyingContract }).toEqual(domain(31337, fmAddr))

    for (let i = 0; i < 100; i++) {
      const note = {
        certificateId: toHex(crypto.getRandomValues(new Uint8Array(32))),
        cumulative: BigInt(toHex(crypto.getRandomValues(new Uint8Array(1 + (i % 32))))),
        memo: newRequestId(),
      }
      const onchain = await pub.readContract({
        address: fm,
        abi: flyingMoneyAbi,
        functionName: 'noteDigest',
        args: [note.certificateId, note.cumulative, note.memo],
      })
      expect(hashNote(31337, fm, note)).toBe(onchain)
    }

    await wait(await wallet.writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'faucet' }))
    await wait(
      await wallet.writeContract({ address: usdc, abi: mockUsdcAbi, functionName: 'approve', args: [fm, 10n ** 18n] }),
    )
    const { timestamp } = await pub.getBlock()
    const args = [other.address, spender.address, 1_000_000n, timestamp + 86_400n] as const
    const { result: id } = await pub.simulateContract({
      account: deployer,
      address: fm,
      abi: flyingMoneyAbi,
      functionName: 'issue',
      args,
    })
    expect(id).toBe(certificateId(31337, fm, deployer.address, 0n))
    await wait(await wallet.writeContract({ address: fm, abi: flyingMoneyAbi, functionName: 'issue', args }))

    const signed = await signNote(spender, 31337, fm, { certificateId: id, cumulative: 250_000n, memo: newRequestId() })
    const { result: paid } = await pub.simulateContract({
      account: deployer,
      address: fm,
      abi: flyingMoneyAbi,
      functionName: 'redeem',
      args: [signed.certificateId, signed.cumulative, signed.memo, signed.sig],
    })
    expect(paid).toBe(250_000n)
  }, 60_000)
})
