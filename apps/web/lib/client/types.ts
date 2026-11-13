import type { NetworkId } from "@tegata/config"
import type { DelegateDraft } from "@tegata/core/near"

export interface AccountView {
  id: string
  network: NetworkId
  accountId: string
  /** The operator's transaction that created the account on NEAR. */
  createdTx: string | null
  /** The operator's transaction that registered it on USDC. */
  registeredTx: string | null
  readyAt: string | null
  /** USDC base units as a string. */
  balance?: string
}

export interface Profile {
  user: {
    id: string
    email: string | null
    handle: string | null
    publicKey: string | null
    /** Set when they signed in with a NEAR wallet: their own account is their pay address. */
    walletAccountId?: string | null
    walletNetwork?: NetworkId | null
  }
  workspace?: {
    id: string
    name: string
    timezone: string
    address: string | null
    taxId: string | null
    email: string | null
    /** Where the logo is served, or null. */
    logo: string | null
  }
  accounts: AccountView[]
  networks: NetworkId[]
  /** Whether this server can email invoices and receipts (Resend configured). */
  emailEnabled?: boolean
}

export interface RelayStatus {
  id: string
  status: "drafted" | "signed" | "sent" | "success" | "failed" | "unknown" | "expired"
  error: string | null
  txHash: string | null
  explorerUrl: string | null
}

export interface SendDraft {
  relayId: string
  draft: DelegateDraft
  to: string
  amount: string
}

/** A payout to another chain through NEAR Intents, as the screens see it. */
export interface PayoutView {
  id: string
  status: "drafted" | "sending" | "processing" | "delivered" | "refunded" | "failed"
  swapStatus: string | null
  /** USDC base units sent from the balance. */
  amount: string
  symbol: string
  chain: string
  recipient: string
  /** What the quote said arrives, in the coin. */
  amountOutFormatted: string | null
  /** The transfer on NEAR. */
  txHash: string | null
  /** The delivery on the other chain. */
  destinationTx: string | null
  error: string | null
  deliveredAt: string | null
  timeEstimate: number | null
  createdAt: string
}

/** A committed payout: the gas-free transfer to approve. */
export interface PayoutDraft {
  payout: PayoutView
  relayId: string
  draft: DelegateDraft
  depositAddress: string
}

/** What a payout would deliver, before anything is committed. */
export interface PayoutPreview {
  amountOutFormatted: string
  minAmountOut: string
  amountOutUsd: string
  timeEstimate: number | null
}

/** Where one attempt to pay a request stands. */
export type PaymentStatus =
  | "awaiting"
  | "detected"
  | "settling"
  | "succeeded"
  | "refunded"
  | "failed"
  | "expired"

export type PaymentRail = "tegata" | "near_wallet" | "oneclick" | "manual" | "card"

export interface ActivityItem {
  id: string
  /**
   * send: a one-off send · paid: a pay link this person paid · received: a payment into one of their links ·
   * reward: a referral reward · payroll: a run the business paid · payslip: pay this person received.
   */
  kind: "send" | "paid" | "received" | "reward" | "payroll" | "payslip"
  network: NetworkId
  /** A NEAR account, or the business that was paid. */
  counterparty: string
  /** The pay link's title, for payments. */
  title: string | null
  /** USDC base units as a string. */
  amount: string
  status: RelayStatus["status"] | PaymentStatus
  /** Its receipt: every movement opens one first, and the receipt links to NEAR. Null until there is one. */
  receiptUrl: string | null
  at: string
  /** A payment in: how it was paid, and the 1Click asset a payment from another chain came in. */
  rail?: PaymentRail | null
  assetIn?: string | null
}

export interface PayLink {
  id: string
  token: string
  title: string
  note: string | null
  /** USDC base units; null when the payer types the amount. */
  amount: string | null
  status: "open" | "paid" | "closed"
  network: NetworkId
  receiverId: string
  paidCount: number
  /** USDC base units. */
  paidTotal: string
  createdAt: string
}

export interface LinkPayment {
  id: string
  rail: PaymentRail
  status: PaymentStatus
  amount: string
  payer: string | null
  payerEmail: string | null
  txHash: string | null
  error: string | null
  settledAt: string | null
  createdAt: string
  receiptToken: string | null
  /** Paid through NEAR Intents: the 1Click asset id the payer sent (its coin and chain mark). */
  assetIn?: string | null
}

export interface LinkDetail {
  request: PayLink
  payments: LinkPayment[]
}

/** What the public pay page knows: nothing private. */
export interface PublicRequest {
  token: string
  business: string
  /** The business's logo URL, or null (the seal stands in). */
  logo: string | null
  title: string
  note: string | null
  amount: string | null
  status: PayLink["status"]
  network: NetworkId
  receiverId: string
  usdc: string
  /** A checkout session's return address: the payer goes back to the merchant once paid. */
  successUrl: string | null
  /** A paid one-time request's receipt (a checkout session or a counter sale), for a payer who comes back. */
  receiptToken: string | null
  /** Set when this is an invoice's pay page. */
  invoice: {
    number: string
    allowPartial: boolean
    dueDate: string
    /** USDC base units still to pay. */
    remaining: string
  } | null
}

export interface AttemptView {
  id: string
  status: PaymentStatus
  rail: PaymentRail
  relayStatus: RelayStatus["status"] | null
  amount: string
  error: string | null
  receiptToken: string | null
  explorerUrl: string | null
  /** Live, paying from another chain: where to send, how much, and what NEAR Intents reports. */
  oneclick?: {
    depositAddress: string | null
    depositMemo: string | null
    amountIn: string | null
    amountInFormatted: string | null
    minAmountIn: string | null
    assetIn: string | null
    refundTo: string | null
    deadline: string | null
    swapStatus: string | null
    originTx: string | null
    timeEstimate: number | null
    symbol: string | null
    chain: string | null
    /** Mark ids for the coin sent and its chain ("usdt", "tron"). */
    coin?: string | null
    chainMark?: string | null
    payUri: string | null
  } | null
  /** Paying by card: Transak's order and its status. */
  card?: { orderId: string | null; orderStatus: string | null } | null
}

export interface TegataAttempt {
  paymentId: string
  relayId: string
  draft: DelegateDraft
  amount: string
  receiverId: string
}

export interface WalletAttempt {
  paymentId: string
  network: NetworkId
  receiverId: string
  amount: string
  memo: string
}

/** A receipt for any money movement: a customer payment (numbered), a send, or a referral reward. */
// --- spend cards -----------------------------------------------------------------------------------

export type CardToneName = "ink" | "matcha" | "sora" | "sakura" | "kin" | "ai"

export interface IssuedCardView {
  id: string
  /** Null: the owner's own card. */
  personId: string | null
  holderName: string
  nickname: string
  tone: CardToneName
  last4: string | null
  status: "making" | "active" | "frozen" | "removed" | "failed"
  frozenBy: "owner" | "person" | null
  /** USDC base units a month; null is no limit. */
  monthlyLimit: string | null
  onCard: string
  spentThisMonth: string
  error: string | null
  createdAt: string
}

export interface CardPurchaseView {
  id: string
  cardId: string
  kind: "authorization" | "settlement" | "reversal" | "declined"
  merchant: string | null
  amount: string | null
  reason: string | null
  createdAt: string
}

export interface CardMoveView {
  id: string
  direction: "in" | "out"
  amount: string
  status: "drafted" | "sent" | "done" | "failed"
  txHash: string | null
  error: string | null
  createdAt: string
}

export interface ReceiptView {
  kind: "payment" | "send" | "reward" | "payslip"
  /** The business's receipt number; only customer payments are numbered. */
  number: number | null
  /** Whose receipt this is: the header and the seal (Tegata's own for a reward). */
  business: string
  logo: string | null
  title: string
  amount: string
  /** How the money moved. */
  method: PaymentRail | "reward" | "payroll" | "autopilot"
  payer: string | null
  payerName: string | null
  receiverName: string
  receiverId: string
  network: NetworkId
  /** Null while NEAR hasn't settled it yet. */
  settledAt: string | null
  /** Who paid the network fee; null when nothing ran on NEAR (marked paid by hand). */
  feeBy: "tegata" | "payer" | null
  txHash: string | null
  explorerUrl: string | null
  /** What was paid for, when it has a public page: the invoice (`/i/…`) or the pay page (`/pay/…`). */
  forUrl?: string | null
  /** USDC base units refunded so far, when any. */
  refunded?: string | null
  /** Live from another chain: the coin and chain it was paid in, e.g. "USDT on Tron". */
  via?: string | null
  /** Live from another chain: the 1Click asset id the payer sent, for its coin and chain marks. */
  assetIn?: string | null
  /** Live to another chain: what NEAR Intents delivered, where, and that chain's transaction. */
  deliveredAs?: {
    route: string
    coin: string
    chainMark: string
    amount: string | null
    txUrl: string | null
  } | null
}

export interface Customer {
  id: string
  name: string
  email: string | null
  address: string | null
  taxId: string | null
  invoices?: number
  /** USDC base units. */
  invoiced?: string
  paid?: string
  outstanding?: string
}

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "partly_paid"
  | "overdue"
  | "paid"
  | "void"

export interface InvoiceRow {
  id: string
  number: number | null
  customer: string | null
  customerId: string | null
  issueDate: string
  dueDate: string
  total: string
  paid: string
  remaining: string
  status: InvoiceStatus
  token: string | null
  paidAt: string | null
  createdAt: string
}

/** The builder's form, exactly as typed; the server does the maths again. */
export interface DraftForm {
  customerId: string | null
  issueDate: string
  dueDate: string
  notes: string
  discount: { kind: "percent" | "fixed"; value: string } | null
  taxRate: string
  allowPartial: boolean
  reminders: boolean
  repeat: "weekly" | "monthly" | null
  lines: { description: string; quantity: string; unitPrice: string }[]
}

export interface InvoiceEvent {
  id: string
  kind:
    | "created"
    | "sent"
    | "emailed"
    | "email_failed"
    | "viewed"
    | "payment"
    | "reminder"
    | "marked_paid"
    | "paid"
    | "voided"
  detail: Record<string, string | number | null> | null
  createdAt: string
}

/** An invoice's reminders after it was sent. */
export interface ReminderState {
  on: boolean
  /** The next scheduled one, with its label in the business's time zone ("Fri 20 Nov, 09:00 · on the due date"). */
  next: { at: string; offset: number; label: string } | null
  left: number
  canSend: boolean
  why: string | null
  email: string | null
  remindedToday: boolean
}

export interface InvoiceDetail {
  invoice: {
    id: string
    number: number | null
    status: "draft" | "open" | "paid" | "void"
    network: NetworkId
    issueDate: string
    dueDate: string
    notes: string | null
    discountKind: "percent" | "fixed" | null
    discountValue: string | null
    taxBp: number
    subtotal: string
    discount: string
    tax: string
    total: string
    allowPartial: boolean
    reminders: boolean
    repeat: "weekly" | "monthly" | null
    billFrom: {
      name: string
      email: string | null
      address: string | null
      taxId: string | null
    } | null
    billTo: {
      name: string
      email: string | null
      address: string | null
      taxId: string | null
    } | null
    sentAt: string | null
    viewedAt: string | null
    paidAt: string | null
    voidedAt: string | null
    scheduleId: string | null
  }
  lines: {
    id: string
    description: string
    quantityMilli: string
    unitPrice: string
    amount: string
  }[]
  events: InvoiceEvent[]
  customer: Customer | null
  payments: LinkPayment[]
  token: string | null
  paidTotal: string
  remaining: string
  status: InvoiceStatus
  draft: {
    customerId: string | null
    issueDate: string
    dueDate: string
    notes: string | null
    discount: { kind: "percent"; bp: number } | { kind: "fixed"; amount: string } | null
    taxBp: number
    allowPartial: boolean
    reminders: boolean
    repeat: "weekly" | "monthly" | null
    lines: { description: string; quantityMilli: string; unitPrice: string }[]
  } | null
  /** Where its reminders stand; null on a draft, a paid or a voided invoice. */
  reminders: ReminderState | null
}

export interface ReferralRow {
  id: string
  status: "open" | "qualified" | "paid" | "void"
  business: string
  handle: string | null
  /** USDC base units received from payers who count. */
  received: string
  lockedAt: string | null
  qualifiedAt: string | null
  payoutAfter: string | null
  paidAt: string | null
  voidReason: string | null
  createdAt: string
  payout: {
    id: string
    status: "queued" | "sent" | "failed"
    txHash: string | null
    error: string | null
  } | null
}

export interface ReferralRules {
  threshold: string
  reward: string
  windowDays: number
  holdMinutes: number
  yearlyCap: number
}

export interface ReferralsView {
  handle: string | null
  network: NetworkId
  rules: ReferralRules
  invited: ReferralRow[]
  referredBy: ReferralRow | null
}

// --- pay people ---------------------------------------------------------------------------------

export type PayCadence = "weekly" | "fortnightly" | "monthly"

/** Where pay lands: a Tegata account, a NEAR account, or an address on another chain (Live, through NEAR Intents). */
export type DestinationKind = "tegata" | "near" | "chain"

/**
 * Whether a person can be paid now, and where: the NEAR account, or for `chain` the address on that chain and its
 * route ("usdt-tron").
 */
export type PayReadiness =
  | { state: "ready"; kind: DestinationKind; accountId: string; route?: string | null }
  | { state: "opening"; kind: DestinationKind; accountId: string | null }
  | { state: "none" }

export interface PendingDestination {
  kind: DestinationKind
  accountId: string | null
  route?: string | null
  activatesAt: string
}

export interface TeamPerson {
  id: string
  name: string
  email: string | null
  role: string | null
  /** Pay per run, USDC base units. */
  amount: string
  /** `/p/<token>`: their own page. */
  token: string
  claimed: boolean
  invitedAt: string | null
  ready: PayReadiness
  pending: PendingDestination | null
  setBy: "person" | "owner" | null
}

export interface PaySlipRow {
  id: string
  amount: string
  label: string
  paidAt: string | null
}

export interface PayRunSummary {
  id: string
  source: "approval" | "autopilot"
  payday: string
  label: string
  status: "draft" | "approved" | "paid" | "failed"
  total: string
  people: number
  paidAt: string | null
}

export interface PayrollOverview {
  timezone: string
  schedule: { cadence: PayCadence; nextPayday: string; label: string } | null
  runs: PayRunSummary[]
  emailEnabled: boolean
}

export interface PayRunRow {
  id: string
  personId: string
  name: string
  role: string | null
  destinationKind: DestinationKind | null
  accountId: string | null
  /** For a row paid to another chain: its route ("usdt-tron"). */
  route?: string | null
  amount: string
  status: "included" | "excluded" | "skipped" | "paid" | "failed"
  skipReason: string | null
  batch: number | null
  relayStatus: RelayStatus["status"] | null
  txHash: string | null
}

export interface PayRun {
  id: string
  source: "approval" | "autopilot"
  payday: string
  label: string
  status: "draft" | "approved" | "paid" | "failed"
  total: string
  attempt: number
  error: string | null
  senderId: string
  network: NetworkId
  approvedAt: string | null
  paidAt: string | null
  /** One per all-or-nothing batch. */
  transactions: { hash: string; url: string }[]
  rows: PayRunRow[]
}

export interface RunBatchDraft {
  relayId: string
  draft: DelegateDraft
  /**
   * What each transfer in the batch does. `accountId` is where the USDC goes on NEAR: the person's account, or for a
   * row paid to another chain the NEAR Intents deposit address, with `via` naming where it lands and no memo.
   */
  rows: {
    id: string
    accountId: string
    amount: string
    memo: string | null
    via: { route: string; recipient: string; amountOut: string | null } | null
  }[]
}

/** What `/p/<token>` shows the person. */
export interface PersonPage {
  token: string
  name: string
  role: string | null
  amount: string
  cadence: PayCadence | null
  business: string
  logo: string | null
  network: NetworkId
  emailHint: string | null
  claimed: boolean
  ready: PayReadiness
  pending: PendingDestination | null
  slips: PaySlipRow[]
}

// --- autopilot ----------------------------------------------------------------------------------------

export interface AutopilotRowView {
  personId: string
  name: string
  role: string | null
  destinationKind: DestinationKind
  accountId: string
  amount: string
}

export interface AutopilotView {
  contract: string
  contractUrl: string
  /** The newest autopilot of any status: money left after it's off is withdrawn through it. */
  lastId: string | null
  /** The business's time zone: paydays run at 09:00 there. */
  timezone: string
  row: {
    id: string
    status: "preparing" | "ready" | "approved" | "on" | "off" | "failed"
    planId: string | null
    paydays: string[]
    dueMs: number[]
    rows: AutopilotRowView[]
    total: string
    setAside: string
    underfunded: { payday: string; needed: string; available: string; at: string } | null
    error: string | null
  } | null
  /** The contract's numbers for this business, in USDC base units. */
  funds: { available: string; reserved: string; inFlight: string } | null
  plan: {
    status: "Active" | "Paused" | "Finished"
    next: number
    cursor: number
    due: number[]
    lastPaid: number
    lastFailed: number
  } | null
}

export interface AutopilotPreview {
  cadence: PayCadence
  paydays: string[]
  dueMs: number[]
  rows: AutopilotRowView[]
  left: { name: string; reason: string }[]
  total: string
  timezone: string
}

// --- books -------------------------------------------------------------------------------------------

export type MovementKind =
  | "payment_in"
  | "payment_out"
  | "send"
  | "refund"
  | "reward"
  | "test_dollars"
  | "payroll"
  | "payslip"
  | "autopilot_set_aside"
  | "autopilot_back"
  | "bank_out"
  | "bank_in"

export interface MovementView {
  id: string
  kind: MovementKind
  direction: "in" | "out"
  at: string
  amount: string
  title: string
  counterparty: string | null
  counterpartyAccount: string | null
  status: "done" | "pending" | "failed"
  txHash: string | null
  explorerUrl: string | null
  /** The page it opens. */
  url: string | null
  /** False for an autopilot payroll: shown, not totalled. */
  counted: boolean
  refunded: string
  /** A payment in: how it was paid, and the 1Click asset a payment from another chain came in. */
  rail?: PaymentRail | null
  assetIn?: string | null
  /** A bank movement: its local currency and amount. */
  fiat?: string | null
  fiatAmount?: string | null
  refundable: {
    paymentId: string
    left: string
    /** The NEAR account that paid, or the payer's own address on their chain. */
    payer: string
    rail: "tegata" | "near_wallet" | "oneclick"
    assetIn: string | null
    /** Paid from another chain: the coin and chain the refund goes back in. */
    route: { id: string; symbol: string; chain: string; coin: string; chainMark: string } | null
  } | null
}

export interface BooksMonth {
  month: string
  label: string
  timezone: string
  moneyIn: string
  moneyOut: string
  net: string
  movements: MovementView[]
}

export interface Reconciliation {
  accountId: string
  balance: string
  checked: number
  outside: { txHash: string; at: string; delta: string; other: string; explorerUrl: string }[]
}

// --- developers ----------------------------------------------------------------------------------------

export interface DevelopersView {
  appUrl: string
  keys: { id: string; name: string; prefix: string; createdAt: string; lastUsedAt: string | null }[]
  endpoints: {
    id: string
    url: string
    inbox: boolean
    enabled: boolean
    secretHint: string
    createdAt: string
  }[]
  deliveries: {
    id: string
    endpointId: string
    eventId: string
    type: string
    status: "pending" | "delivered" | "failed"
    attempts: number
    lastStatus: number | null
    lastError: string | null
    createdAt: string
    payload: string
  }[]
  inbox: {
    id: string
    type: string | null
    verified: boolean
    webhookId: string | null
    receivedAt: string
  }[]
}
