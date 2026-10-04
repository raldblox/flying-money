import type { Chain, Hex } from 'viem'
import {
  anvil,
  arbitrum,
  arbitrumSepolia,
  arc as arcMainnet,
  arcTestnet,
  base,
  baseSepolia,
  monad,
  monadTestnet,
} from 'viem/chains'

/**
 * @flying-money/chains — the ONLY place chain IDs, RPCs, USDC addresses, explorers and caps live
 * (BUILD_SPEC §5.4). No other code may hard-code these values.
 */

export type ChainKey =
  | 'arbitrum'
  | 'arbitrum-sepolia'
  | 'monad'
  | 'monad-testnet'
  | 'arc'
  | 'arc-testnet'
  | 'base'
  | 'base-sepolia'
  | 'anvil'

export interface ChainConfig {
  key: ChainKey
  chain: Chain
  mainnet: boolean
  /** Circle USDC, ERC-20 interface, 6 decimals. Zero address for `anvil` until MockUSDC is registered locally. */
  usdc: Hex
  gasToken: 'ETH' | 'MON' | 'USDC'
  explorer: string
  faucets: string[]
  /** 0 on deterministic-finality chains (Arc), 1 on Monad, 1 on Arbitrum/Base L2 soft-confirm. */
  confirmations: number
  /** Mirrors the deployment's immutable per-certificate cap (§7.1 #9). 0 = unlimited. */
  maxFaceValue: bigint
  /**
   * Mirrors the deployment's immutable deployment-wide cap (§7.1 #9, §7.5). 0 = unlimited.
   * Part of the registry so every constructor argument comes from it.
   */
  maxTotalOutstanding: bigint
  /** Keyless source verification endpoint (Blockscout API), when the chain has one (DECISIONS D16). */
  blockscoutApi?: string
  flyingMoney?: Hex
  deployedBlock?: bigint
  /** Public, chain-specific notes for /chains/[chain] (§21.2). Plain facts only; no claims beyond §3.5. */
  notes: string[]
}

export const USDC_DECIMALS = 6 as const
const ZERO: Hex = '0x0000000000000000000000000000000000000000'

/** Mainnet launch caps (§7.1 #9, §7.5): 100 USDC per certificate, 1,000 USDC deployment-wide. */
export const MAINNET_MAX_FACE_VALUE = 100_000_000n
export const MAINNET_MAX_TOTAL_OUTSTANDING = 1_000_000_000n

const explorerOf = (c: Chain): string => c.blockExplorers?.default.url ?? ''
const CIRCLE_FAUCET = 'https://faucet.circle.com'

type Base = Omit<ChainConfig, 'flyingMoney' | 'deployedBlock'>

const testnetCaps = { maxFaceValue: 0n, maxTotalOutstanding: 0n }
const mainnetCaps = { maxFaceValue: MAINNET_MAX_FACE_VALUE, maxTotalOutstanding: MAINNET_MAX_TOTAL_OUTSTANDING }

export const baseRegistry: Record<ChainKey, Base> = {
  arbitrum: {
    key: 'arbitrum',
    blockscoutApi: 'https://arbitrum.blockscout.com/api/',
    chain: arbitrum,
    mainnet: true,
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    gasToken: 'ETH',
    explorer: explorerOf(arbitrum),
    faucets: [],
    confirmations: 1,
    ...mainnetCaps,
    notes: ['An Ethereum layer 2; gas is paid in ETH.', 'Close to existing agent and DeFi ecosystems.'],
  },
  'arbitrum-sepolia': {
    key: 'arbitrum-sepolia',
    blockscoutApi: 'https://arbitrum-sepolia.blockscout.com/api/',
    chain: arbitrumSepolia,
    mainnet: false,
    usdc: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
    gasToken: 'ETH',
    explorer: explorerOf(arbitrumSepolia),
    faucets: [CIRCLE_FAUCET],
    confirmations: 1,
    ...testnetCaps,
    notes: ['The Arbitrum test network: test USDC from the Circle faucet, test ETH for gas.'],
  },
  monad: {
    key: 'monad',
    chain: monad,
    mainnet: true,
    usdc: '0x754704Bc059F8C67012fEd69BC8A327a5aafb603',
    gasToken: 'MON',
    explorer: explorerOf(monad),
    faucets: [],
    confirmations: 1,
    ...mainnetCaps,
    notes: ['Gas is paid in MON.', 'Fast blocks: a seller’s single collect transaction lands almost at once.'],
  },
  'monad-testnet': {
    key: 'monad-testnet',
    chain: monadTestnet,
    mainnet: false,
    usdc: '0x534b2f3A21130d7a60830c2Df862319e593943A3',
    gasToken: 'MON',
    explorer: explorerOf(monadTestnet),
    faucets: [CIRCLE_FAUCET],
    confirmations: 1,
    ...testnetCaps,
    notes: ['The Monad test network: test USDC from the Circle faucet, test MON for gas.'],
  },
  arc: {
    key: 'arc',
    chain: arcMainnet,
    mainnet: true,
    usdc: '0x3600000000000000000000000000000000000000',
    gasToken: 'USDC',
    explorer: 'https://explorer.arc.io',
    faucets: [],
    confirmations: 0,
    ...mainnetCaps,
    notes: [
      'Gas is paid in USDC, so shops and sellers only ever need USDC.',
      'Sub-second, deterministic finality: a collect is final as soon as it lands.',
    ],
  },
  'arc-testnet': {
    key: 'arc-testnet',
    chain: arcTestnet,
    mainnet: false,
    usdc: '0x3600000000000000000000000000000000000000',
    gasToken: 'USDC',
    explorer: explorerOf(arcTestnet),
    faucets: [CIRCLE_FAUCET],
    confirmations: 0,
    ...testnetCaps,
    notes: ['The Arc test network: gas is paid in test USDC from the Circle faucet.'],
  },
  base: {
    key: 'base',
    blockscoutApi: 'https://base.blockscout.com/api/',
    chain: base,
    mainnet: true,
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    gasToken: 'ETH',
    explorer: explorerOf(base),
    faucets: [],
    confirmations: 1,
    ...mainnetCaps,
    notes: ['An Ethereum layer 2; gas is paid in ETH.', 'Close to existing agent-payment ecosystems.'],
  },
  'base-sepolia': {
    key: 'base-sepolia',
    blockscoutApi: 'https://base-sepolia.blockscout.com/api/',
    chain: baseSepolia,
    mainnet: false,
    usdc: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
    gasToken: 'ETH',
    explorer: explorerOf(baseSepolia),
    faucets: [CIRCLE_FAUCET],
    confirmations: 1,
    ...testnetCaps,
    notes: ['The Base test network: test USDC from the Circle faucet, test ETH for gas.'],
  },
  anvil: {
    key: 'anvil',
    chain: anvil,
    mainnet: false,
    usdc: ZERO, // MockUSDC, registered at runtime via setLocalDeployment()
    gasToken: 'ETH',
    explorer: '',
    faucets: [],
    confirmations: 1,
    ...testnetCaps,
    notes: ['A local development chain.'],
  },
}

/** Spec-mandated RPC defaults where §5.4/§18 give one explicitly; other chains use viem's default. */
export const rpcEnvVar: Record<ChainKey, string> = {
  arbitrum: 'RPC_ARBITRUM',
  'arbitrum-sepolia': 'RPC_ARBITRUM_SEPOLIA',
  monad: 'RPC_MONAD',
  'monad-testnet': 'RPC_MONAD_TESTNET',
  arc: 'RPC_ARC',
  'arc-testnet': 'RPC_ARC_TESTNET',
  base: 'RPC_BASE',
  'base-sepolia': 'RPC_BASE_SEPOLIA',
  anvil: 'RPC_ANVIL',
}

const specRpc: Partial<Record<ChainKey, string>> = {
  'monad-testnet': 'https://testnet-rpc.monad.xyz',
  arc: 'https://rpc.mainnet.arc.io',
  'arc-testnet': 'https://rpc.testnet.arc.io',
}

export const chainKeys = Object.keys(baseRegistry) as ChainKey[]

export function isChainKey(k: string): k is ChainKey {
  return Object.hasOwn(baseRegistry, k)
}

/** Default RPC for a chain; `env` (e.g. process.env) may override via RPC_<KEY>. */
export function rpcUrl(key: ChainKey, env: Record<string, string | undefined> = {}): string {
  const override = env[rpcEnvVar[key]]
  if (override) return override
  const url = specRpc[key] ?? baseRegistry[key].chain.rpcUrls.default.http[0]
  if (!url) throw new Error(`No RPC for ${key}`)
  return url
}
