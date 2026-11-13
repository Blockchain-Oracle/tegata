// Bank payouts and bank details through Noah (plan 6.8 AC; context/09-realworld-money/bank-alternatives.md).
//
// Withdraw to a bank: the business approves one gas-free USDC transfer on NEAR; the money then reaches Noah as USDC
// on Solana and Noah pays the bank. In Live that hop is NEAR Intents; NEAR Intents has no testnet, so in the Sandbox
// Tegata's operator takes the test USDC on NEAR and Tegata's own Solana devnet wallet hands Noah's test USDC to Noah.
// The NEAR leg and the Noah leg are both real; the README says the Sandbox hop is Tegata's.
//
// Bank details: a Noah virtual account for the business. A deposit is bought as USDC and delivered to Tegata's wallet
// on Solana; Tegata then credits the business's USDC on NEAR once per Noah transaction.
import { NETWORKS, type NetworkId } from "@tegata/config"
import {
  ftTransfer,
  matchingTransfer,
  type Operator,
  readUsdcTransfers,
  toAction,
  tokenBalance,
  usdcBalance,
} from "@tegata/core/near"
import {
  bankDetails,
  channelForm,
  NOAH_TEST_USDC_MINT,
  type NoahClient,
  NoahError,
  payoutWorkflow,
  prepareSell,
  putSandboxCustomer,
  type SellChannel,
  sellChannels,
  simulateDeposit,
} from "@tegata/core/noah"
import { type Db, schema } from "@tegata/db"
import { and, desc, eq, inArray } from "drizzle-orm"

import { createRelayDraft } from "./relays.ts"

const {
  bankCustomers,
  bankPayoutAccounts,
  bankPayouts,
  bankAccounts,
  bankDeposits,
  relays,
  workspaces,
  users,
  accounts,
} = schema

const USDC_DECIMALS = 6
const UNITS = 1_000_000n

export class BankError extends Error {
  constructor(
    readonly code: "not_live" | "no_channel" | "bad_input" | "not_found" | "noah" | "wrong_state",
    message: string,
  ) {
    super(message)
  }
}

/** Countries with a local-currency bank payout in Noah's sandbox (read 2026-11-13), first the one we lead with. */
export const BANK_COUNTRIES = [
  { code: "NG", fiat: "NGN", name: "Nigeria" },
  { code: "GH", fiat: "GHS", name: "Ghana" },
  { code: "ZA", fiat: "ZAR", name: "South Africa" },
] as const

/** Bank payouts run on Noah's sandbox in the Sandbox; Live waits for Noah's production business review. */
export function assertBankNetwork(network: NetworkId) {
  if (network !== "testnet")
    throw new BankError(
      "not_live",
      "Bank payouts in Live open once Noah's business review is done. They run in the Sandbox today.",
    )
}

const dollars = (units: bigint) => `${units / UNITS}.${(units % UNITS).toString().padStart(6, "0")}`
const toUnits = (decimal: string) => {
  const [whole = "0", frac = ""] = decimal.split(".")
  return BigInt(whole) * UNITS + BigInt((frac + "000000").slice(0, 6))
}
const noahError = (error: unknown) =>
  new BankError(
    "noah",
    error instanceof NoahError
      ? error.message.replace(/^Noah \S+ \S+: /, "")
      : "Noah didn't answer. Try again.",
  )

/** The business's customer at Noah, created on first use (in the Sandbox directly, without a KYC wait). */
export async function ensureBankCustomer(
  db: Db,
  noah: NoahClient,
  input: { userId: string; network: NetworkId },
) {
  const [found] = await db
    .select()
    .from(bankCustomers)
    .where(and(eq(bankCustomers.userId, input.userId), eq(bankCustomers.network, input.network)))
  if (found) return found.noahCustomerId
  const [row] = await db
    .select({ name: workspaces.name, email: users.email, business: workspaces.email })
    .from(users)
    .leftJoin(workspaces, eq(workspaces.ownerId, users.id))
    .where(eq(users.id, input.userId))
  const words = (row?.name ?? "Tegata Business").trim().split(/\s+/)
  const id = `tegata-${input.userId}`
  try {
    await putSandboxCustomer(noah, id, {
      firstName: words[0] ?? "Tegata",
      lastName: words.slice(1).join(" ") || "Business",
      email: row?.business ?? row?.email ?? null,
      country: "NG",
    })
  } catch (error) {
    throw noahError(error)
  }
  await db
    .insert(bankCustomers)
    .values({ userId: input.userId, network: input.network, noahCustomerId: id })
    .onConflictDoNothing()
  return id
}

export interface BankQuote {
  channelId: string
  country: string
  fiat: string
  rate: string
  /** What the bank account receives, after Noah's fee. */
  fiatAmount: string
  fee: string
  /** Dollars. */
  min: string
  max: string
  seconds: number
}

/** A live quote: how much `amount` (USDC base units) becomes in the bank account, from Noah's channel. */
export async function bankQuote(
  noah: NoahClient,
  input: { country: string; amount: bigint },
): Promise<BankQuote> {
  const country = BANK_COUNTRIES.find((c) => c.code === input.country)
  if (!country) throw new BankError("no_channel", "Bank payouts aren't offered to that country yet")
  let channel: SellChannel | undefined
  try {
    const { Items } = await sellChannels(noah, { country: country.code, fiat: country.fiat })
    channel = Items.find((c) => c.PaymentMethodType === "BankLocal") ?? Items[0]
  } catch (error) {
    throw noahError(error)
  }
  if (!channel)
    throw new BankError("no_channel", `Noah has no bank payout to ${country.name} right now`)
  const limits = (
    channel as SellChannel & { CryptoLimits?: { MinLimit: string; MaxLimit: string } }
  ).CryptoLimits
  const rate = Number(channel.Rate)
  const gross = (Number(dollars(input.amount)) * rate).toFixed(2)
  let fee = "0"
  try {
    const { Items } = await sellChannels(noah, {
      country: country.code,
      fiat: country.fiat,
      fiatAmount: gross,
    })
    fee = Items.find((c) => c.ID === channel?.ID)?.Calculated?.TotalFee ?? "0"
  } catch {
    // Below the minimum Noah returns nothing priced: the limits below say so.
  }
  return {
    channelId: channel.ID,
    country: country.code,
    fiat: country.fiat,
    rate: channel.Rate,
    fiatAmount: Math.max(0, Number(gross) - Number(fee)).toFixed(2),
    fee,
    min: limits?.MinLimit ?? "1",
    max: limits?.MaxLimit ?? "1000",
    seconds: channel.ProcessingSeconds,
  }
}

/** The bank's own form for a channel (bank, account number, payment purpose…), as Noah defines it. */
export async function bankForm(noah: NoahClient, channelId: string) {
  try {
    return (await channelForm(noah, channelId)).FormSchema
  } catch (error) {
    throw noahError(error)
  }
}

/** "Access Bank ••3456" from a filled form. */
function accountLabel(form: unknown) {
  const details = (form as { BankDetails?: { Bank?: string; AccountNumber?: string } }).BankDetails
  const number = details?.AccountNumber ?? ""
  return `${details?.Bank ?? "Bank account"} ••${number.slice(-4)}`
}

/**
 * Commit to a withdrawal: Noah checks the bank details and sets a payout rule for the exact amount from Tegata's
 * Solana wallet; the business approves one gas-free transfer of the USDC to Tegata's operator on NEAR.
 */
export async function createBankPayout(
  db: Db,
  noah: NoahClient,
  input: {
    workspaceId: string
    userId: string
    publicKey: string
    senderId: string
    network: NetworkId
    country: string
    amount: bigint
    form?: unknown
    payoutAccountId?: string
    /** Tegata's Solana wallet, the address Noah watches for the deposit. */
    hopAddress: string
  },
) {
  assertBankNetwork(input.network)
  if (input.amount <= 0n) throw new BankError("bad_input", "Enter an amount above zero")
  if ((await usdcBalance(input.network, input.senderId)) < input.amount)
    throw new BankError("bad_input", "Not enough dollars in your balance")
  let form = input.form
  let payoutAccountId = input.payoutAccountId
  if (payoutAccountId) {
    const [saved] = await db
      .select()
      .from(bankPayoutAccounts)
      .where(
        and(
          eq(bankPayoutAccounts.id, payoutAccountId),
          eq(bankPayoutAccounts.workspaceId, input.workspaceId),
        ),
      )
    if (!saved) throw new BankError("not_found", "That bank account isn't saved here")
    form = saved.form
  }
  if (!form) throw new BankError("bad_input", "Enter the bank details")
  const quote = await bankQuote(noah, { country: input.country, amount: input.amount })
  const amountText = dollars(input.amount).replace(/0+$/, "").replace(/\.$/, "")
  if (Number(amountText) < Number(quote.min))
    throw new BankError(
      "bad_input",
      `The least Noah pays out to this bank is $${Number(quote.min).toFixed(2)}`,
    )
  if (Number(amountText) > Number(quote.max))
    throw new BankError(
      "bad_input",
      `The most Noah pays out at once is $${Number(quote.max).toFixed(2)}`,
    )
  const customerId = await ensureBankCustomer(db, noah, {
    userId: input.userId,
    network: input.network,
  })
  const payoutId = crypto.randomUUID()
  let formSessionId: string
  let ruleId: string | null
  let depositAddress: string | undefined
  try {
    formSessionId = (
      await prepareSell(noah, {
        channelId: quote.channelId,
        customerId,
        cryptoAmount: amountText,
        form,
      })
    ).FormSessionID
    const rule = await payoutWorkflow(noah, {
      customerId,
      formSessionId,
      sourceAddress: input.hopAddress,
      amount: amountText,
      nonce: payoutId,
    })
    ruleId = rule.RuleID ?? null
    depositAddress = rule.Conditions?.[0]?.DestinationAddress?.Address
  } catch (error) {
    throw noahError(error)
  }
  if (!depositAddress)
    throw new BankError("noah", "Noah didn't return where to send the money. Try again.")
  if (!payoutAccountId) {
    const [saved] = await db
      .insert(bankPayoutAccounts)
      .values({
        workspaceId: input.workspaceId,
        network: input.network,
        country: quote.country,
        fiat: quote.fiat,
        label: accountLabel(form),
        form,
      })
      .returning()
    payoutAccountId = saved?.id
  }
  if (!payoutAccountId) throw new Error("Could not save the bank account")
  const [payout] = await db
    .insert(bankPayouts)
    .values({
      id: payoutId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      network: input.network,
      payoutAccountId,
      amount: input.amount,
      fiat: quote.fiat,
      fiatAmount: quote.fiatAmount,
      rate: quote.rate,
      fee: quote.fee,
      channelId: quote.channelId,
      formSessionId,
      ruleId,
      depositAddress,
    })
    .returning()
  if (!payout) throw new Error("Could not save the withdrawal")
  const operator = NETWORKS[input.network].operator
  const { relayId, draft } = await createRelayDraft(db, {
    userId: input.userId,
    network: input.network,
    purpose: `bank:${payout.id}`,
    senderId: input.senderId,
    receiverId: NETWORKS[input.network].usdc,
    publicKey: input.publicKey,
    calls: [ftTransfer(operator, input.amount, bankMemo(payout.id))],
  })
  await db.update(bankPayouts).set({ relayId }).where(eq(bankPayouts.id, payout.id))
  return { payout: { ...payout, relayId }, relayId, draft, operator }
}

export const bankMemo = (payoutId: string) => `tegata:bank:${payoutId}`

/** After the relay: the USDC reached Tegata's operator on NEAR (read from the USDC event), or nothing moved. */
export async function settleBankRelay(db: Db, relayId: string, operatorId: string) {
  const [relay] = await db.select().from(relays).where(eq(relays.id, relayId))
  if (!relay?.purpose.startsWith("bank:")) return null
  const id = relay.purpose.slice("bank:".length)
  const [payout] = await db.select().from(bankPayouts).where(eq(bankPayouts.id, id))
  if (payout?.status !== "drafted") return null
  if (relay.status === "failed" || relay.status === "expired") {
    await db
      .update(bankPayouts)
      .set({
        status: "failed",
        error: relay.error ?? "NEAR didn't accept the transfer. Nothing moved.",
      })
      .where(eq(bankPayouts.id, id))
    return null
  }
  if (relay.status !== "success" || !relay.txHash) return null
  const read = await readUsdcTransfers(relay.network, relay.txHash, operatorId)
  if (read.state === "pending") return null
  const landed =
    read.ok &&
    matchingTransfer(read.transfers, {
      to: NETWORKS[relay.network].operator,
      amount: payout.amount,
      memo: bankMemo(payout.id),
    })
  await db
    .update(bankPayouts)
    .set(
      landed
        ? { status: "converting", nearTx: relay.txHash, error: null }
        : { status: "failed", error: "The transfer didn't land on NEAR. Nothing moved." },
    )
    .where(and(eq(bankPayouts.id, id), eq(bankPayouts.status, "drafted")))
  return landed ? id : null
}

/**
 * Hand the money to Noah: Tegata's Solana wallet sends the exact amount of test USDC to Noah's deposit address (the
 * Sandbox stand-in for NEAR Intents' hop). Safe to repeat: a saved hop transaction is never sent twice.
 */
export async function hopBankPayout(
  db: Db,
  id: string,
  send: (input: { to: string; amount: bigint }) => Promise<string>,
) {
  const [payout] = await db.select().from(bankPayouts).where(eq(bankPayouts.id, id))
  if (payout?.status !== "converting" || payout.hopTx || !payout.depositAddress)
    return payout?.status ?? null
  // Claim it first, so two workers never send twice.
  const [claimed] = await db
    .update(bankPayouts)
    .set({ hopTx: "sending" })
    .where(
      and(
        eq(bankPayouts.id, id),
        eq(bankPayouts.status, "converting"),
        eq(bankPayouts.hopTx, payout.hopTx ?? ""),
      ),
    )
    .returning()
  const ready = claimed ?? (await db.select().from(bankPayouts).where(eq(bankPayouts.id, id)))[0]
  if (!ready || (ready.hopTx && ready.hopTx !== "sending")) return ready?.status ?? null
  try {
    const signature = await send({ to: payout.depositAddress, amount: payout.amount })
    await db
      .update(bankPayouts)
      .set({ hopTx: signature, status: "paying", error: null })
      .where(eq(bankPayouts.id, id))
    return "paying"
  } catch (error) {
    await db
      .update(bankPayouts)
      .set({
        hopTx: null,
        error: error instanceof Error ? error.message : "The hop to Noah failed",
      })
      .where(eq(bankPayouts.id, id))
    return "converting"
  }
}

interface NoahTransaction {
  ID: string
  Status: "Pending" | "Failed" | "Settled"
  Direction: "In" | "Out"
  Network: string
  Amount?: string
  DestinationAddress?: { Address: string } | null
  FiatPayment?: { Amount: string; FiatCurrency: string } | null
  Orchestration?: { RuleID?: string; RuleExecutionID?: string } | null
  Created: string
}

async function customerTransactions(noah: NoahClient, customerId: string, from?: Date) {
  const q = new URLSearchParams({ CustomerID: customerId, PageSize: "50", SortDirection: "DESC" })
  if (from) q.set("CreatedFrom", new Date(from.getTime() - 60_000).toISOString())
  return (await noah.get<{ Items: NoahTransaction[] }>(`/transactions?${q}`)).Items ?? []
}

export type BankPoll = "pending" | "paid" | "failed"

/** Read Noah once for a payout on its way to the bank. Settled when Noah's payout for our rule settled. */
export async function pollBankPayout(db: Db, noah: NoahClient, id: string): Promise<BankPoll> {
  const [row] = await db
    .select({ payout: bankPayouts, customer: bankCustomers.noahCustomerId })
    .from(bankPayouts)
    .innerJoin(
      bankCustomers,
      and(
        eq(bankCustomers.userId, bankPayouts.userId),
        eq(bankCustomers.network, bankPayouts.network),
      ),
    )
    .where(eq(bankPayouts.id, id))
  if (row?.payout.status !== "paying") return row?.payout.status === "paid" ? "paid" : "pending"
  const items = await customerTransactions(noah, row.customer, row.payout.createdAt)
  const mine = items.filter(
    (t) => t.Orchestration?.RuleID && t.Orchestration.RuleID === row.payout.ruleId,
  )
  const payout =
    mine.find((t) => t.Direction === "Out" && t.FiatPayment) ??
    mine.find((t) => t.Direction === "Out")
  if (payout?.Status === "Settled") {
    await db
      .update(bankPayouts)
      .set({ status: "paid", noahTxId: payout.ID, paidAt: new Date(), error: null })
      .where(and(eq(bankPayouts.id, id), eq(bankPayouts.status, "paying")))
    return "paid"
  }
  if (mine.some((t) => t.Status === "Failed")) {
    await db
      .update(bankPayouts)
      .set({
        status: "failed",
        noahTxId: payout?.ID ?? null,
        error: "Noah couldn't pay the bank account",
      })
      .where(and(eq(bankPayouts.id, id), eq(bankPayouts.status, "paying")))
    return "failed"
  }
  return "pending"
}

/** Withdrawals still moving (the worker sweeps these). */
export function bankPayoutsToMove(db: Db) {
  return db
    .select({ id: bankPayouts.id, status: bankPayouts.status, updatedAt: bankPayouts.updatedAt })
    .from(bankPayouts)
    .where(inArray(bankPayouts.status, ["converting", "paying"]))
}

/**
 * A withdrawal that failed after the USDC reached the operator: the operator sends it back (Sandbox), once, with the
 * hash saved before broadcast.
 */
export async function returnFailedBankPayout(db: Db, operator: Operator, id: string) {
  const [payout] = await db.select().from(bankPayouts).where(eq(bankPayouts.id, id))
  if (payout?.status !== "failed" || !payout.nearTx || payout.error?.startsWith("Returned")) return
  const [owner] = await db
    .select({ accountId: accounts.accountId })
    .from(accounts)
    .where(and(eq(accounts.userId, payout.userId), eq(accounts.network, payout.network)))
  if (!owner) return
  const result = await operator.send(NETWORKS[payout.network].usdc, [
    toAction(ftTransfer(owner.accountId, payout.amount, `tegata:bankback:${payout.id}`)),
  ])
  if (result.status === "success")
    await db
      .update(bankPayouts)
      .set({ error: `Returned to your balance: ${payout.error ?? "the bank payout failed"}` })
      .where(eq(bankPayouts.id, id))
}

// --- bank details --------------------------------------------------------------------------------------------------

/** The business's bank details, creating the account at Noah on first use (EUR in the Sandbox). */
export async function ensureBankDetails(
  db: Db,
  noah: NoahClient,
  input: { workspaceId: string; userId: string; network: NetworkId; hopAddress: string },
) {
  assertBankNetwork(input.network)
  const fiat = "EUR"
  const [found] = await db
    .select()
    .from(bankAccounts)
    .where(
      and(
        eq(bankAccounts.workspaceId, input.workspaceId),
        eq(bankAccounts.network, input.network),
        eq(bankAccounts.fiat, fiat),
      ),
    )
  if (found) return found
  const customerId = await ensureBankCustomer(db, noah, {
    userId: input.userId,
    network: input.network,
  })
  let account: Awaited<ReturnType<typeof bankDetails>>
  try {
    account = await bankDetails(noah, { customerId, fiat, destination: input.hopAddress })
  } catch (error) {
    throw noahError(error)
  }
  const [row] = await db
    .insert(bankAccounts)
    .values({
      workspaceId: input.workspaceId,
      network: input.network,
      fiat,
      virtualAccountId: account.VirtualAccountID,
      paymentMethodId: account.PaymentMethodID,
      details: {
        holder: account.AccountHolderName,
        number: account.AccountNumber,
        bank: account.BankName,
        code: account.BankCode ?? null,
        rail: account.PaymentMethodType,
      },
    })
    .onConflictDoNothing()
    .returning()
  return (
    row ??
    (await db.select().from(bankAccounts).where(eq(bankAccounts.workspaceId, input.workspaceId)))[0]
  )
}

/** Sandbox: a bank transfer into the business's account, run through Noah's real flow. */
export async function simulateBankDeposit(
  db: Db,
  noah: NoahClient,
  input: { workspaceId: string; network: NetworkId; amount: string },
) {
  assertBankNetwork(input.network)
  const [account] = await db
    .select()
    .from(bankAccounts)
    .where(
      and(eq(bankAccounts.workspaceId, input.workspaceId), eq(bankAccounts.network, input.network)),
    )
  if (!account) throw new BankError("not_found", "Get your bank details first")
  const value = Number(input.amount)
  if (!(value >= 1 && value <= 20)) throw new BankError("bad_input", "Simulate between €1 and €20")
  try {
    return await simulateDeposit(noah, {
      paymentMethodId: account.paymentMethodId,
      amount: value.toFixed(2),
      fiat: account.fiat,
      reference: `tegata:${input.workspaceId}`,
    })
  } catch (error) {
    throw noahError(error)
  }
}

/**
 * Worker: every bank deposit Noah has delivered to Tegata's wallet for a business is credited to its USDC on NEAR,
 * once per Noah transaction (the operator's transfer hash is saved before broadcast).
 */
export async function creditBankDeposits(
  db: Db,
  noah: NoahClient,
  operator: Operator,
  hopAddress: string,
) {
  const rows = await db
    .select({
      account: bankAccounts,
      customer: bankCustomers.noahCustomerId,
      owner: workspaces.ownerId,
    })
    .from(bankAccounts)
    .innerJoin(workspaces, eq(workspaces.id, bankAccounts.workspaceId))
    .innerJoin(
      bankCustomers,
      and(
        eq(bankCustomers.userId, workspaces.ownerId),
        eq(bankCustomers.network, bankAccounts.network),
      ),
    )
    .where(eq(bankAccounts.network, operator.network))
  const credited: string[] = []
  for (const row of rows) {
    const items = await customerTransactions(noah, row.customer, row.account.createdAt).catch(
      () => [],
    )
    const byExecution = new Map(items.map((t) => [t.Orchestration?.RuleExecutionID, t]))
    for (const t of items) {
      if (
        t.Direction !== "Out" ||
        t.Status !== "Settled" ||
        t.DestinationAddress?.Address !== hopAddress
      )
        continue
      if (!t.Amount) continue
      const bought = byExecution.get(t.Orchestration?.RuleExecutionID)
      const fiat = items.find(
        (x) =>
          x.Direction === "In" &&
          x.FiatPayment &&
          x.Orchestration?.RuleExecutionID === t.Orchestration?.RuleExecutionID,
      )?.FiatPayment
      const [deposit] = await db
        .insert(bankDeposits)
        .values({
          noahTxId: t.ID,
          workspaceId: row.account.workspaceId,
          network: row.account.network,
          fiatAmount: fiat?.Amount ?? bought?.FiatPayment?.Amount ?? "0",
          fiat: fiat?.FiatCurrency ?? row.account.fiat,
          amount: toUnits(t.Amount),
        })
        .onConflictDoNothing()
        .returning()
      if (!deposit) continue
      const [owner] = await db
        .select({ accountId: accounts.accountId })
        .from(accounts)
        .where(and(eq(accounts.userId, row.owner), eq(accounts.network, operator.network)))
      if (!owner) continue
      const usdc = NETWORKS[operator.network].usdc
      if ((await tokenBalance(operator.network, usdc, operator.accountId)) < deposit.amount) {
        await db
          .update(bankDeposits)
          .set({ status: "failed", error: "Tegata's Sandbox stash can't cover this deposit" })
          .where(eq(bankDeposits.id, deposit.id))
        continue
      }
      const result = await operator.send(
        usdc,
        [toAction(ftTransfer(owner.accountId, deposit.amount, `tegata:bankin:${deposit.id}`))],
        async (tx) => {
          await db
            .update(bankDeposits)
            .set({ creditTx: tx.hash })
            .where(eq(bankDeposits.id, deposit.id))
        },
      )
      await db
        .update(bankDeposits)
        .set({
          status:
            result.status === "success"
              ? "credited"
              : result.status === "unknown"
                ? "pending"
                : "failed",
        })
        .where(eq(bankDeposits.id, deposit.id))
      if (result.status === "success") credited.push(deposit.id)
    }
  }
  return credited
}

/** What the Bank page shows: saved accounts, recent withdrawals, bank details and deposits. */
export async function bankOverview(db: Db, workspaceId: string, network: NetworkId) {
  const [saved, payouts, [details], deposits] = await Promise.all([
    db
      .select()
      .from(bankPayoutAccounts)
      .where(
        and(
          eq(bankPayoutAccounts.workspaceId, workspaceId),
          eq(bankPayoutAccounts.network, network),
        ),
      )
      .orderBy(desc(bankPayoutAccounts.createdAt)),
    db
      .select({ payout: bankPayouts, label: bankPayoutAccounts.label })
      .from(bankPayouts)
      .innerJoin(bankPayoutAccounts, eq(bankPayoutAccounts.id, bankPayouts.payoutAccountId))
      .where(and(eq(bankPayouts.workspaceId, workspaceId), eq(bankPayouts.network, network)))
      .orderBy(desc(bankPayouts.createdAt))
      .limit(20),
    db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.workspaceId, workspaceId), eq(bankAccounts.network, network))),
    db
      .select()
      .from(bankDeposits)
      .where(and(eq(bankDeposits.workspaceId, workspaceId), eq(bankDeposits.network, network)))
      .orderBy(desc(bankDeposits.createdAt))
      .limit(20),
  ])
  return { saved, payouts, details: details ?? null, deposits }
}

export async function getBankPayout(db: Db, workspaceId: string, id: string) {
  const [row] = await db
    .select({ payout: bankPayouts, label: bankPayoutAccounts.label })
    .from(bankPayouts)
    .innerJoin(bankPayoutAccounts, eq(bankPayoutAccounts.id, bankPayouts.payoutAccountId))
    .where(and(eq(bankPayouts.id, id), eq(bankPayouts.workspaceId, workspaceId)))
  return row ?? null
}

export { NOAH_TEST_USDC_MINT, USDC_DECIMALS }
