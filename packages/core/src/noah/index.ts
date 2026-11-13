// Noah (https://docs.noah.com), the licensed partner behind bank payouts and bank details (plan 6.8 AC). Crypto-native:
// it takes USDC and pays a local bank (Nigeria, NGN, first), and gives a business bank details whose deposits arrive as
// USDC. Server only; the key never reaches a browser. Sandbox: api.sandbox.noah.com with `X-Api-Key` (request signing is
// optional while the key has no public key). Shapes verified against the sandbox on 2026-11-13
// (context/09-realworld-money/bank-alternatives.md §1.4–1.5).

export const NOAH_SANDBOX = "https://api.sandbox.noah.com/v1"
/** Noah's own sandbox USDC (not Circle's), on Solana devnet. */
export const NOAH_TEST_USDC = { currency: "USDC_TEST", network: "SolanaDevnet" } as const
export const NOAH_TEST_USDC_MINT = "3jjDg2fo6Dw2YjYD7cTLPHnXn5mYXojp6ePDXVHhq11p"

export class NoahError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
  ) {
    super(message)
  }
}

export interface NoahClient {
  get<T>(path: string): Promise<T>
  send<T>(method: "POST" | "PUT", path: string, body: unknown): Promise<T>
}

export function noahClient(apiKey: string, base = NOAH_SANDBOX): NoahClient {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: {
        "X-Api-Key": apiKey,
        accept: "application/json",
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    })
    const text = await response.text()
    if (!response.ok) {
      let detail = text.slice(0, 300)
      try {
        const body = JSON.parse(text) as {
          Detail?: string
          RequestExtension?: { Body?: { Description?: string; Field?: string }[] }
        }
        // Noah's field-level reason ("Account could not be verified at the selected bank") beats "invalid request".
        const field = body.RequestExtension?.Body?.[0]
        detail = field?.Description ?? body.Detail ?? detail
      } catch {}
      throw new NoahError(`Noah ${method} ${path.split("?")[0]}: ${detail}`, response.status)
    }
    return (text ? JSON.parse(text) : {}) as T
  }
  return {
    get: (path) => request("GET", path),
    send: (method, path, body) => request(method, path, body),
  }
}

export interface SellChannel {
  ID: string
  PaymentMethodType: string
  Country: string
  FiatCurrency: string
  Rate: string
  ProcessingSeconds: number
  Limits: { MinLimit: string; MaxLimit: string }
  Calculated?: { TotalFee: string; FiatAmount?: string }
}

/** The ways to pay out in a country and currency, with a live rate (ids change: never hard-code one). */
export function sellChannels(
  noah: NoahClient,
  input: { country: string; fiat: string; fiatAmount?: string },
) {
  const q = new URLSearchParams({
    Country: input.country,
    CryptoCurrency: NOAH_TEST_USDC.currency,
    FiatCurrency: input.fiat,
    ...(input.fiatAmount ? { FiatAmount: input.fiatAmount } : {}),
  })
  return noah.get<{ Items: SellChannel[] }>(`/channels/sell?${q}`)
}

/** The bank's own form for a channel (a JSON Schema: bank, account number, payment purpose). */
export function channelForm(noah: NoahClient, channelId: string) {
  return noah.get<{ FormSchema: unknown; FormMetadata?: { ContentHash: string } }>(
    `/channels/${encodeURIComponent(channelId)}/form`,
  )
}

/**
 * A test customer created directly (Noah's sandbox Reliance model), so a Sandbox user isn't sent through KYC. Noah's
 * sandbox wants an email and, for a euro account, an EU address: the test identity is a Berlin one (sandbox data only;
 * it can still pay out to Nigeria). Live customers go through Noah's hosted KYC instead.
 */
export function putSandboxCustomer(
  noah: NoahClient,
  customerId: string,
  person: { firstName: string; lastName: string; email: string },
) {
  return noah.send("PUT", `/customers/${encodeURIComponent(customerId)}`, {
    Type: "Individual",
    FullName: { FirstName: person.firstName, LastName: person.lastName },
    DateOfBirth: "1990-01-15",
    Email: person.email,
    Identities: [
      {
        IssuingCountry: "DE",
        IDNumber: "T22000129",
        IDType: "Passport",
        IssuedDate: "2020-01-01",
        ExpiryDate: "2030-01-01",
      },
    ],
    PrimaryResidence: {
      Street: "Hauptstrasse 1",
      City: "Berlin",
      PostCode: "10115",
      State: "Berlin",
      Country: "DE",
    },
  })
}

/** Noah's sandbox bank accounts that pass its beneficiary check (Access Bank, Nigeria). */
export const NOAH_TEST_BANK_ACCOUNTS = [
  { country: "NG", bank: "Access Bank", accountNumber: "0690000031" },
] as const

/** Prepare a sale: the form is checked by Noah and a session id comes back for the payout workflow. */
export function prepareSell(
  noah: NoahClient,
  input: { channelId: string; customerId: string; cryptoAmount: string; form: unknown },
) {
  return noah.send<{
    FormSessionID?: string
    Quote?: { SignedQuote?: string }
    /** A continuation (e.g. a beneficiary check needing more data), not a failure. */
    NextStep?: { Schema?: unknown }
  }>("POST", "/transactions/sell/prepare", {
    ChannelID: input.channelId,
    CryptoCurrency: NOAH_TEST_USDC.currency,
    CustomerID: input.customerId,
    CryptoAmount: input.cryptoAmount,
    Form: input.form,
  })
}

/** The beneficiary name Noah's bank check found, from a prepare's `NextStep` (null when there's no such step). */
export function beneficiaryName(next: { Schema?: unknown } | undefined): string | null {
  const ack = (
    next?.Schema as {
      properties?: {
        Acknowledgements?: { properties?: Record<string, { "x-confirmation-value"?: string }> }
      }
    }
  )?.properties?.Acknowledgements?.properties
  const field = ack ? Object.values(ack)[0] : undefined
  return field?.["x-confirmation-value"] ?? null
}

/** Continue a form session once the business confirmed the beneficiary Noah found. */
export function confirmBeneficiary(
  noah: NoahClient,
  input: {
    channelId: string
    customerId: string
    cryptoAmount: string
    formSessionId: string
    form: unknown
  },
) {
  return noah.send<{ FormSessionID?: string; NextStep?: { Schema?: unknown } }>(
    "POST",
    "/transactions/sell/prepare",
    {
      ChannelID: input.channelId,
      CryptoCurrency: NOAH_TEST_USDC.currency,
      CustomerID: input.customerId,
      CryptoAmount: input.cryptoAmount,
      FormSessionID: input.formSessionId,
      Form: { ...(input.form as object), Acknowledgements: { CoBName: true } },
    },
  )
}

/**
 * The payout rule: when `amount` USDC arrives from `sourceAddress` at the returned deposit address, Noah sells it and
 * pays the bank. Valid up to seven days.
 */
export function payoutWorkflow(
  noah: NoahClient,
  input: {
    customerId: string
    formSessionId: string
    sourceAddress: string
    amount: string
    nonce: string
  },
) {
  return noah.send<{
    RuleID?: string
    Conditions?: { DestinationAddress?: { Address: string }; Network: string }[]
  }>("POST", "/workflows/onchain-deposit-to-payment-method", {
    CustomerID: input.customerId,
    CryptoCurrency: NOAH_TEST_USDC.currency,
    FormSessionID: input.formSessionId,
    Trigger: {
      Type: "SingleOnchainDepositSourceTriggerInput",
      SourceAddress: input.sourceAddress,
      Conditions: [
        {
          Network: NOAH_TEST_USDC.network,
          // Exactly this amount (Noah's schema: ComparisonOperator EQ / LTEQ / GTEQ).
          AmountConditions: [{ ComparisonOperator: "EQ", Value: input.amount }],
        },
      ],
      Nonce: input.nonce,
      Expiry: new Date(Date.now() + 6 * 86_400_000).toISOString(),
    },
  })
}

export interface VirtualAccount {
  AccountHolderName: string
  AccountNumber: string
  BankCode?: string
  BankName: string
  PaymentMethodID: string
  PaymentMethodType: string
  VirtualAccountID: string
  Fee?: { TotalFeePct?: string; TotalFeeMin?: string; FiatCurrencyCode?: string }
}

/** Bank details for a customer: money paid in is bought as USDC and delivered to `destination`. */
export function bankDetails(
  noah: NoahClient,
  input: { customerId: string; fiat: string; destination: string },
) {
  return noah.send<VirtualAccount>("POST", "/workflows/bank-deposit-to-onchain-address", {
    CustomerID: input.customerId,
    FiatCurrency: input.fiat,
    CryptoCurrency: NOAH_TEST_USDC.currency,
    Network: NOAH_TEST_USDC.network,
    DestinationAddress: { Address: input.destination },
  })
}

/** Sandbox: a bank transfer into a virtual account, run through Noah's real flow. */
export function simulateDeposit(
  noah: NoahClient,
  input: { paymentMethodId: string; amount: string; fiat: string; reference?: string },
) {
  return noah.send<{ FiatDepositID: string }>("POST", "/sandbox/fiat-deposit/simulate", {
    PaymentMethodID: input.paymentMethodId,
    FiatAmount: input.amount,
    FiatCurrency: input.fiat,
    ...(input.reference ? { Reference: input.reference } : {}),
  })
}
