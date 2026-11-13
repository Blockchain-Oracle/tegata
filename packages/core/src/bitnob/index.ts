// Bitnob (https://www.bitnob.dev), the crypto-native card issuer behind Tegata's spend cards (plan 6.8 AD;
// context/09-realworld-money/cards-v2.md). Virtual Visa cards for a business and its people, each with its own balance;
// freeze, limits, reveal and purchases by webhook. Server only: the client id and secret never reach a browser.
// Sandbox and Live share the base URL; the key picks the environment. Amounts are micro-units (1 USD = 1,000,000).
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

export const BITNOB_BASE = "https://api.bitnob.com"
/** Bitnob funds a prepaid card with at least this much (micro-units). */
export const BITNOB_MIN_FUNDING = 2_000_000n

export class BitnobError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
    readonly code?: string,
  ) {
    super(message)
  }
}

export interface BitnobClient {
  get<T>(path: string): Promise<T>
  send<T>(method: "POST" | "PUT" | "PATCH" | "DELETE", path: string, body?: unknown): Promise<T>
}

/**
 * Every call is signed: X-Auth-Signature is the hex HMAC-SHA256 of `{clientId}:{timestamp}:{nonce}:{body}` keyed with
 * the client secret (empty body for GET), with the timestamp in Unix seconds and a fresh nonce.
 */
export function bitnobClient(clientId: string, secret: string, base = BITNOB_BASE): BitnobClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const raw = body === undefined ? "" : JSON.stringify(body)
    const timestamp = Math.floor(Date.now() / 1000).toString()
    const nonce = randomBytes(16).toString("hex")
    const signature = createHmac("sha256", secret)
      .update(`${clientId}:${timestamp}:${nonce}:${raw}`)
      .digest("hex")
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        "X-Auth-Client": clientId,
        "X-Auth-Timestamp": timestamp,
        "X-Auth-Nonce": nonce,
        "X-Auth-Signature": signature,
        accept: "application/json",
        ...(raw ? { "content-type": "application/json" } : {}),
      },
      body: raw || undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    })
    const text = await response.text()
    let json: { data?: unknown; message?: string; code?: string; error?: { message?: string } } = {}
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      // Not JSON: the status line says enough.
    }
    if (!response.ok)
      throw new BitnobError(
        json.message ??
          json.error?.message ??
          `Bitnob ${method} ${path.split("?")[0]}: HTTP ${response.status}`,
        response.status,
        json.code,
      )
    return (json.data ?? json) as T
  }
  return {
    get: (path) => request("GET", path),
    send: (method, path, body) => request(method, path, body),
  }
}

/** A card as Bitnob returns it (optional strings are omitted when unset; amounts are integer strings). */
export interface BitnobCard {
  id: string
  status: string
  last_four_digit?: string
  masked_pan?: string
  balance?: string
  currency?: string
  reference?: string
  customer_id?: string
}

export const whoami = (b: BitnobClient) =>
  b.get<{ environment?: string; company?: { name?: string } }>("/api/whoami")

/**
 * A cardholder at Bitnob. In the Sandbox, the person's real name and email with Bitnob's test identity (the Sandbox
 * needs no real documents, and the KYC outcome is simulated), the way Noah's sandbox customers are made.
 */
export function createCardholder(
  b: BitnobClient,
  input: { firstName: string; lastName: string; email: string },
) {
  return b.send<{ id?: string; customer_id?: string; status?: string }>("POST", "/api/cards/kyc", {
    terms_of_service_accepted: true,
    customer: {
      customer_type: "individual",
      first_name: input.firstName,
      last_name: input.lastName,
      email: input.email,
      date_of_birth: "1990-01-15",
      id_type: "passport",
      id_number: "A00000000",
      line1: "1 Admiralty Way",
      city: "Lagos",
      state: "Lagos",
      postal_code: "101233",
      country: "NGA",
      dial_code: "+234",
      phone_number: "8000000000",
    },
    employment_status: "self_employed",
    account_purpose: "Business spending",
    expected_monthly_volume: 1000,
    annual_salary: 50000,
  })
}

/** Sandbox: approve a cardholder's KYC at once. */
export const approveCardholder = (b: BitnobClient, customerId: string) =>
  b.send("POST", `/api/cards/kyc/${customerId}/simulate-webhook`, { event_type: "kyc-approved" })

/** A prepaid virtual Visa card, funded at creation (at least $2). It starts pending; card.created follows. */
export function createCard(
  b: BitnobClient,
  input: {
    customerId: string
    amount: bigint
    reference: string
    monthlyLimit: bigint | null
    webhookUrl: string
  },
) {
  return b.send<BitnobCard>("POST", "/api/cards", {
    card_type: "virtual",
    card_brand: "visa",
    currency: "USD",
    customer_id: input.customerId,
    amount: Number(input.amount),
    reference: input.reference,
    webhook_url: input.webhookUrl,
    ...(input.monthlyLimit ? { card_limits: { monthly_limit: Number(input.monthlyLimit) } } : {}),
  })
}

export const getCard = (b: BitnobClient, cardId: string) =>
  b.get<BitnobCard>(`/api/cards/${cardId}`)

/** Money onto the card (fund) or off it (withdraw), against Bitnob's company balance. */
export const moveCardBalance = (
  b: BitnobClient,
  cardId: string,
  input: { type: "fund" | "withdraw"; amount: bigint; reference: string },
) =>
  b.send("POST", `/api/cards/${cardId}/balance`, {
    type: input.type,
    amount: Number(input.amount),
    reference: input.reference,
  })

export const setCardStatus = (b: BitnobClient, cardId: string, status: "frozen" | "active") =>
  b.send("POST", `/api/cards/${cardId}/status`, { status })

export const setCardLimit = (b: BitnobClient, cardId: string, monthlyLimit: bigint | null) =>
  b.send("PUT", `/api/cards/${cardId}/spend-limits`, {
    spending_limits: { monthly_limit: monthlyLimit === null ? 0 : Number(monthlyLimit) },
  })

/** Sandbox: Bitnob sends this card event to the card's webhook (nothing is recorded on Bitnob's side). */
export const simulateCardEvent = (
  b: BitnobClient,
  cardId: string,
  event: "authorization" | "settlement" | "reversal" | "decline",
) => b.send("POST", `/api/cards/${cardId}/simulate-webhook`, { event_type: event })

export const terminateCard = (b: BitnobClient, cardId: string) =>
  b.send("DELETE", `/api/cards/${cardId}`)

/** The card's number, expiry and CVV, for the cardholder only (never stored by Tegata). */
export const revealCard = (b: BitnobClient, cardId: string) =>
  b.get<{ card_number?: string; expiry?: string; cvv?: string; encrypted_details?: string }>(
    `/api/cards/${cardId}/secure`,
  )

/** `x-bitnob-signature`: the hex HMAC-SHA512 of the raw body with the webhook secret, compared in constant time. */
export function verifyBitnobWebhook(raw: string, signature: string | null, secret: string) {
  if (!signature) return false
  const expected = createHmac("sha512", secret).update(raw).digest("hex")
  const a = Buffer.from(expected)
  const b = Buffer.from(signature.trim().toLowerCase())
  return a.length === b.length && timingSafeEqual(a, b)
}

/** A card webhook, read defensively: Bitnob's payloads name the event, the card and (for purchases) the merchant. */
export interface CardEvent {
  eventId: string
  type: "created" | "authorization" | "settlement" | "reversal" | "declined" | "other"
  cardId: string | null
  amount: bigint | null
  merchant: string | null
  reason: string | null
  lastFour: string | null
}

export function readCardEvent(body: Record<string, unknown>): CardEvent {
  const event = String(body.event ?? body.event_type ?? body.type ?? "")
  const data = (body.data ?? body) as Record<string, unknown>
  const merchant = (data.merchant ?? {}) as Record<string, unknown>
  const amount = data.amount ?? data.transaction_amount
  const type = event.includes("created")
    ? "created"
    : event.includes("authoriz")
      ? "authorization"
      : event.includes("settle")
        ? "settlement"
        : event.includes("revers")
          ? "reversal"
          : event.includes("declin")
            ? "declined"
            : "other"
  return {
    eventId: String(body.event_id ?? body.id ?? data.id ?? `${event}:${Date.now()}`),
    type,
    cardId: (data.card_id ?? data.cardId ?? (type === "created" ? data.id : null)) as string | null,
    amount:
      typeof amount === "number" || (typeof amount === "string" && /^\d+$/.test(amount))
        ? BigInt(amount)
        : null,
    merchant: (merchant.name ?? data.merchant_name ?? data.description ?? null) as string | null,
    reason: (data.decline_reason ?? data.reason ?? null) as string | null,
    lastFour: (data.last_four_digit ?? data.last4 ?? null) as string | null,
  }
}
