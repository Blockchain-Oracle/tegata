/**
 * Constants only. Nothing in this package reads the environment.
 * Every limit, gas figure and network id used anywhere in Tegata is named here.
 */

export type NetworkId = "mainnet" | "testnet"

/** What the app calls each network. */
export const MODE_LABEL: Record<NetworkId, string> = {
  mainnet: "Live",
  testnet: "Sandbox",
}

export interface NetworkConfig {
  id: NetworkId
  /** Tried in order; the next one is used when a call fails. */
  rpcUrls: readonly string[]
  /** Native USDC issued by Circle (NEP-141). */
  usdc: string
  /** wNEAR, used only by operator tooling. */
  wnear: string
  /** The operator: pays gas, creates user accounts. Parent of every user account. */
  operator: string
  /** The autopilot payroll contract. */
  autopilot: string
  /** The registrar contract that creates top-level names. */
  registrar: string
  explorer: string
}

export const NETWORKS: Record<NetworkId, NetworkConfig> = {
  mainnet: {
    id: "mainnet",
    rpcUrls: ["https://free.rpc.fastnear.com", "https://rpc.mainnet.fastnear.com"],
    usdc: "17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1",
    wnear: "wrap.near",
    operator: "tegata.near",
    autopilot: "pay.tegata.near",
    registrar: "near",
    explorer: "https://nearblocks.io",
  },
  testnet: {
    id: "testnet",
    rpcUrls: ["https://test.rpc.fastnear.com", "https://rpc.testnet.fastnear.com"],
    usdc: "3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af",
    wnear: "wrap.testnet",
    operator: "tegata.testnet",
    autopilot: "pay.tegata.testnet",
    registrar: "testnet",
    explorer: "https://testnet.nearblocks.io",
  },
}

export const USDC_DECIMALS = 6
export const NEAR_DECIMALS = 24

/** 1 Tgas in gas units. */
export const TGAS = 1_000_000_000_000n
/** 1 yoctoNEAR, the deposit NEP-141 transfers require. */
export const ONE_YOCTO = 1n

/** Gas attached to each action the relayer sponsors. */
export const GAS = {
  /** One `ft_transfer` on USDC. Measured burn is about 2.2 Tgas. */
  ftTransfer: 10n * TGAS,
  /** `ft_transfer_call` into the autopilot contract. */
  ftTransferCall: 100n * TGAS,
  /** A registrar's `create_account` (`near`, `testnet`), which creates the account in a callback. */
  registrarCreateAccount: 100n * TGAS,
  /** `storage_deposit` on a token. */
  storageDeposit: 10n * TGAS,
  /** Wrapping NEAR (operator tooling only). */
  nearDeposit: 10n * TGAS,
  /** `create_plan` on the autopilot: up to 100 rows written to storage. */
  autopilotPlan: 100n * TGAS,
  /** pause / resume / cancel / withdraw on the autopilot. */
  autopilotAction: 50n * TGAS,
  /** One `run` call: 20 Tgas plus 18 per row, ten rows a chunk (contract constants). */
  autopilotRun: 300n * TGAS,
} as const

/** The autopilot contract (6.8 T). Numbers match `contracts/autopilot`. */
export const AUTOPILOT = {
  /** NEAR the operator attaches to register a business: its record plus a few plans (a 100-row plan is ~0.038). */
  storageYocto: 100_000_000_000_000_000_000_000n,
  maxRows: 100,
  maxDates: 60,
  /** Paydays to choose from when turning it on. */
  dateChoices: [3, 6, 12] as const,
  /** NEP-297 standard of its events. */
  standard: "tegata_autopilot",
} as const

/** NEP-145 registration on USDC: min = max on both networks (read from `storage_balance_bounds`). */
export const USDC_STORAGE_YOCTO = 1_250_000_000_000_000_000_000n

export const LIMITS = {
  /** `ft_transfer` actions in one sponsored batch. The protocol allows 100 actions per receipt. */
  maxRowsPerBatch: 50,
  /** Blocks a signed delegate action stays valid (about two minutes). */
  delegateTtlBlocks: 120,
  /** Sponsored actions per user. */
  relaysPerHour: 30,
  relaysPerDay: 200,
  handleMinLength: 2,
  handleMaxLength: 32,
} as const

/** Names a user may not take as `name.tegata.near`. */
export const RESERVED_HANDLES: readonly string[] = [
  "pay",
  "app",
  "api",
  "www",
  "admin",
  "relay",
  "operator",
  "tegata",
  "support",
  "docs",
]

/** Sandbox only: test dollars the operator sends a person, once per UTC day (Circle testnet USDC). */
export const TEST_DOLLARS = { units: 5_000_000n, memo: "tegata:test-dollars" } as const

/**
 * A payroll row paid in a stablecoin on another chain is quoted EXACT_OUTPUT, so the person receives exactly their
 * pay and the business covers NEAR Intents' conversion. That extra may be at most 2% of the pay or $1, whichever is
 * more; above it the run says which route costs too much instead of paying it.
 */
export const PAYROLL_CONVERSION = { maxExtraBps: 200n, maxExtraUnits: 1_000_000n } as const

/** The most a row's transfer may exceed its pay (USDC base units), by `PAYROLL_CONVERSION`. */
export const maxConversionExtra = (pay: bigint) => {
  const share = (pay * PAYROLL_CONVERSION.maxExtraBps) / 10_000n
  // The larger of the two (Math.max doesn't take bigint).
  if (share > PAYROLL_CONVERSION.maxExtraUnits) return share
  return PAYROLL_CONVERSION.maxExtraUnits
}

/**
 * Referral rules per network. Live pays $10 to each side once the invited business has received $50
 * from other payers within 30 days, after a 48-hour hold. Sandbox runs the same checks at a tenth of the amounts
 * with a 10-minute hold, so it can be tried with test dollars.
 */
export const REFERRALS = {
  testnet: {
    threshold: 5_000_000n,
    reward: 1_000_000n,
    windowDays: 30,
    holdMs: 10 * 60_000,
    yearlyCap: 10,
  },
  mainnet: {
    threshold: 50_000_000n,
    reward: 10_000_000n,
    windowDays: 30,
    holdMs: 48 * 3_600_000,
    yearlyCap: 10,
  },
} as const satisfies Record<
  NetworkId,
  { threshold: bigint; reward: bigint; windowDays: number; holdMs: number; yearlyCap: number }
>

export const TIMEOUTS = {
  rpcMs: 15_000,
  /** How long to wait for a relayed transaction to reach finality before reporting "unknown". */
  relayFinalityMs: 60_000,
  relayPollMs: 1_000,
} as const

/** Dollar coins, including USDT0 (Tether's omnichain USDT): a quote between them can be tight, and a payout in one
 * arrives at an exact amount. */
export const isStableSymbol = (symbol: string) =>
  symbol === "USDC" || symbol === "USDT" || symbol === "USDT0"

/**
 * Team treasuries: a Sputnik DAO v2 per business that pays payroll only after k of n approvers vote yes. Both networks
 * run the current mainnet DAO code (it checks the proposal kind on every vote), shared on chain as a global contract.
 */
export const TREASURY = {
  /** The DAO code's hash (commit 2b0f34a3), the same global contract on mainnet and testnet. */
  codeHash: "DtHZA1mUmGYeScEaUoUZYQGGFHSMpnjMCvkr5U9hJXuF",
  /** Mainnet treasuries come from the factory Trezu uses, so they open there too. */
  mainnetFactory: "sputnik-dao.near",
  /** NEAR a new treasury starts with: its own state (≈0.01) and room for its first proposals. */
  startYocto: 100_000_000_000_000_000_000_000n,
  /** Kept free for the next proposal; below this the worker tops it up from the operator. */
  minFreeYocto: 50_000_000_000_000_000_000_000n,
  topUpYocto: 100_000_000_000_000_000_000_000n,
  /** `new` on a fresh treasury. */
  initGas: 40n * TGAS,
  /** A vote that doesn't pay anything, and `add_proposal` (a 50-row proposal writes ≈13 KB). */
  voteGas: 30n * TGAS,
  proposeGas: 60n * TGAS,
  /** Each row's `ft_transfer` inside the proposal, and the callback and fees around the batch. */
  rowGas: 10n * TGAS,
  executeOverheadGas: 50n * TGAS,
  /** A proposal stays open this long (Trezu's period). */
  periodNs: 604_800_000_000_000n,
  maxRows: 50,
  /** k can't be 1: one person approving alone is what payroll does without a treasury. */
  minThreshold: 2,
  maxApprovers: 10,
} as const

/** Gas for a vote that may be the one that pays: every row's transfer, the callback, and the vote itself. */
export const treasuryVoteGas = (rows: number) =>
  TREASURY.voteGas + TREASURY.executeOverheadGas + BigInt(rows) * (TREASURY.rowGas + TGAS)
