import type { Chain, Hex } from 'viem'
import { anvil, arbitrumSepolia, arcTestnet, baseSepolia, monadTestnet, sepolia, tempoModerato } from 'viem/chains'

/**
 * @flying-money/chains — the ONLY place chain IDs, RPCs, USDC addresses, explorers and caps live
 * (BUILD_SPEC §5.4). No other code may hard-code these values. Test networks only: the contract is unaudited.
 */

export type ChainKey =
  | 'arbitrum-sepolia'
  | 'monad-testnet'
  | 'arc-testnet'
  | 'base-sepolia'
  | 'ethereum-sepolia'
  | 'tempo-testnet'
  | 'anvil'

export interface ChainConfig {
  key: ChainKey
  /** The network's short brand name for copy ("Arbitrum", "Tempo"); `chain.name` is the full testnet name. */
  brand: string
  chain: Chain
  mainnet: boolean
  /**
   * The settlement stablecoin: Circle USDC, ERC-20 interface, 6 decimals. On Tempo testnet, which has no Circle USDC,
   * it is OUSD (a TIP-20 USD stablecoin, also 6 decimals). Zero address for `anvil` until MockUSDC is registered.
   */
  usdc: Hex
  /** The settlement stablecoin's symbol when it isn't Circle USDC (OUSD on Tempo testnet). */
  stablecoin?: string
  /** What pays gas: a native token, or USD stablecoins on Tempo (which has no native token). */
  gasToken: 'ETH' | 'MON' | 'USDC' | 'USD'
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
  /** A Sourcify-compatible verifier other than sourcify.dev (Tempo runs its own). */
  sourcifyUrl?: string
  flyingMoney?: Hex
  deployedBlock?: bigint
  /** Public, chain-specific notes for /chains/[chain] (§21.2). Plain facts only; no claims beyond §3.5. */
  notes: string[]
}

export const USDC_DECIMALS = 6 as const
const ZERO: Hex = '0x0000000000000000000000000000000000000000'

const explorerOf = (c: Chain): string => c.blockExplorers?.default.url ?? ''
const CIRCLE_FAUCET = 'https://faucet.circle.com'

type Base = Omit<ChainConfig, 'flyingMoney' | 'deployedBlock'>

const testnetCaps = { maxFaceValue: 0n, maxTotalOutstanding: 0n }

export const baseRegistry: Record<ChainKey, Base> = {
  'arbitrum-sepolia': {
    key: 'arbitrum-sepolia',
    brand: 'Arbitrum',
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
  'monad-testnet': {
    key: 'monad-testnet',
    brand: 'Monad',
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
  'arc-testnet': {
    key: 'arc-testnet',
    brand: 'Arc',
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
  'base-sepolia': {
    key: 'base-sepolia',
    brand: 'Base',
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
  'ethereum-sepolia': {
    key: 'ethereum-sepolia',
    brand: 'Ethereum',
    blockscoutApi: 'https://eth-sepolia.blockscout.com/api/',
    chain: sepolia,
    mainnet: false,
    usdc: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    gasToken: 'ETH',
    explorer: explorerOf(sepolia),
    faucets: [CIRCLE_FAUCET],
    confirmations: 1,
    ...testnetCaps,
    notes: ['The Ethereum test network (Sepolia): test USDC from the Circle faucet, test ETH for gas.'],
  },
  'tempo-testnet': {
    key: 'tempo-testnet',
    brand: 'Tempo',
    sourcifyUrl: 'https://contracts.tempo.xyz',
    chain: tempoModerato,
    mainnet: false,
    usdc: '0x20c0000000000000000000006a37da5c996874be',
    stablecoin: 'OUSD',
    gasToken: 'USD',
    explorer: explorerOf(tempoModerato),
    faucets: ['https://docs.tempo.xyz/quickstart/faucet'],
    confirmations: 0,
    ...testnetCaps,
    notes: [
      'The Tempo test network (Moderato). Tempo has no native gas token: fees are paid in USD stablecoins.',
      'Budgets settle in OUSD, Tempo’s recommended USD stablecoin; the faucet gives test OUSD.',
    ],
  },
  anvil: {
    key: 'anvil',
    brand: 'Anvil',
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
  'arbitrum-sepolia': 'RPC_ARBITRUM_SEPOLIA',
  'monad-testnet': 'RPC_MONAD_TESTNET',
  'arc-testnet': 'RPC_ARC_TESTNET',
  'base-sepolia': 'RPC_BASE_SEPOLIA',
  'ethereum-sepolia': 'RPC_ETHEREUM_SEPOLIA',
  'tempo-testnet': 'RPC_TEMPO_TESTNET',
  anvil: 'RPC_ANVIL',
}

const specRpc: Partial<Record<ChainKey, string>> = {
  'monad-testnet': 'https://testnet-rpc.monad.xyz',
  'arc-testnet': 'https://rpc.testnet.arc.io',
  // viem's defaults for these are rate-limited third-party endpoints
  'ethereum-sepolia': 'https://ethereum-sepolia-rpc.publicnode.com',
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
