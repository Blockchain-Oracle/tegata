// Transak (https://docs.transak.com), the card on-ramp behind "pay by card" (job 2):
// a payer's Visa or Mastercard buys native USDC on NEAR, delivered to the
// business's own NEAR account. Server only: the API secret never reaches a browser. Staging is self-serve with test
// cards and always-approved KYC; its NEAR orders deliver nothing, so Sandbox delivery is Tegata's (see the services).

export type TransakEnv = "staging" | "production"

const BASES: Record<TransakEnv, { api: string; gateway: string }> = {
  staging: { api: "https://api-stg.transak.com", gateway: "https://api-gateway-stg.transak.com" },
  production: { api: "https://api.transak.com", gateway: "https://api-gateway.transak.com" },
}

/** What Transak says about an order, as Tegata reads it. */
export const TRANSAK_DONE = new Set(["COMPLETED"])
export const TRANSAK_FAILED = new Set(["FAILED", "CANCELLED", "EXPIRED", "REFUNDED"])
/** Paid by the payer, on its way as USDC. */
export const TRANSAK_CHARGED = new Set([
  "PAYMENT_DONE_MARKED_BY_USER",
  "PROCESSING",
  "PENDING_DELIVERY_FROM_TRANSAK",
  "ON_HOLD_PENDING_DELIVERY_FROM_TRANSAK",
])

/** Card payments price in euros: Transak sells USDC on NEAR for EUR and GBP cards, not USD (cards-v2.md). */
export const CARD_FIAT = "EUR"

export class TransakError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
  ) {
    super(message)
  }
}

export interface TransakOrder {
  id: string
  status: string
  partnerOrderId?: string
  cryptoAmount?: number
  fiatAmount?: number
  fiatCurrency?: string
  totalFeeInFiat?: number
  walletAddress?: string
  transactionHash?: string
  /** The account that sent the USDC on NEAR, when Transak names it. */
  fromWalletAddress?: string
  statusReason?: string
  cardBrand?: string
}

export interface TransakClient {
  env: TransakEnv
  apiKey: string
  widgetUrl(params: Record<string, unknown>): Promise<string>
  order(orderId: string): Promise<TransakOrder>
  quote(input: { cryptoAmount: number }): Promise<{ fiatAmount: number; fee: number; fiat: string }>
}

export function transakClient(input: {
  apiKey: string
  apiSecret: string
  env: TransakEnv
}): TransakClient {
  const base = BASES[input.env]
  let token: { value: string; until: number } | null = null

  async function request<T>(url: string, init: RequestInit): Promise<T> {
    const response = await fetch(url, {
      ...init,
      headers: { accept: "application/json", "content-type": "application/json", ...init.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    })
    const text = await response.text()
    let json: {
      data?: unknown
      response?: unknown
      error?: { message?: string }
      message?: string
    } = {}
    try {
      json = text ? JSON.parse(text) : {}
    } catch {
      // The status line says enough.
    }
    if (!response.ok)
      throw new TransakError(
        json.error?.message ??
          json.message ??
          `Transak ${init.method ?? "GET"} ${new URL(url).pathname}: HTTP ${response.status}`,
        response.status,
      )
    return (json.data ?? json.response ?? json) as T
  }

  /** The partner access token, refreshed with the API secret and cached until shortly before it expires. */
  async function accessToken() {
    if (token && token.until > Date.now() + 60_000) return token.value
    const data = await request<{ accessToken: string; expiresAt: number }>(
      `${base.api}/partners/api/v2/refresh-token`,
      {
        method: "POST",
        headers: { "api-secret": input.apiSecret },
        body: JSON.stringify({ apiKey: input.apiKey }),
      },
    )
    // expiresAt is in seconds.
    token = {
      value: data.accessToken,
      until: (data.expiresAt ?? 0) * 1000 || Date.now() + 3_600_000,
    }
    return token.value
  }

  return {
    env: input.env,
    apiKey: input.apiKey,
    /** A single-use widget URL (five minutes) with everything but the card locked. */
    async widgetUrl(params) {
      const data = await request<{ widgetUrl: string }>(`${base.gateway}/api/v2/auth/session`, {
        method: "POST",
        headers: { "access-token": await accessToken() },
        body: JSON.stringify({ widgetParams: { apiKey: input.apiKey, ...params } }),
      })
      if (!data.widgetUrl) throw new TransakError("Transak didn't return a checkout", 502)
      return data.widgetUrl
    },
    async order(orderId) {
      return request<TransakOrder>(
        `${base.api}/partners/api/v2/order/${encodeURIComponent(orderId)}`,
        {
          method: "GET",
          headers: { "access-token": await accessToken() },
        },
      )
    },
    /** What a card pays for `cryptoAmount` USDC on NEAR, fee included, from Transak's public price. */
    async quote({ cryptoAmount }) {
      const query = new URLSearchParams({
        partnerApiKey: input.apiKey,
        fiatCurrency: CARD_FIAT,
        cryptoCurrency: "USDC",
        isBuyOrSell: "BUY",
        network: "near",
        paymentMethod: "credit_debit_card",
        cryptoAmount: cryptoAmount.toFixed(2),
      })
      const data = await request<{ fiatAmount: number; totalFee: number; fiatCurrency?: string }>(
        `${base.api}/api/v1/pricing/public/quotes?${query}`,
        { method: "GET" },
      )
      return {
        fiatAmount: Number(data.fiatAmount),
        fee: Number(data.totalFee),
        fiat: data.fiatCurrency ?? CARD_FIAT,
      }
    },
  }
}
