"use client"

// New recipient: the bank from a searchable list, the account number, and who holds it. In Nigeria the
// bank itself names the holder as soon as the number is typed (Noah's beneficiary check); Ghana and South Africa ask
// for the name, and South Africa for their contact details too. Built from Noah's live form, so every field it requires
// is asked for.
import { ArrowLeft, BadgeCheck, ChevronRight, FlaskConical, Landmark, Search } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { Segmented } from "@/components/kit/segmented"
import { Sheet } from "@/components/shell/sheet"
import { POPULAR_BANKS } from "@/lib/bank-logos"
import { fire } from "@/lib/feedback"
import { FIAT_NAME, groupNumber, lastFour, titleCase } from "@/lib/fiat"
import { cn } from "@/lib/utils"
import type { FormSchema } from "./bank-view"

import { BankDisc, bankLogo, Flag } from "./parts"

export interface NewRecipient {
  form: Record<string, unknown>
  holder: string | null
  label: string
}

const PURPOSES = ["Salary", "Supplier", "Services", "Family", "Other"] as const
/** Noah's sandbox account that passes the bank check. */
const TEST_ACCOUNT = { bank: "Access Bank", number: "0690000031" }

type Check =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "found"; name: string }
  | { state: "none" }
  | { state: "bad"; text: string }

export function RecipientSheet({
  open,
  onOpenChange,
  country,
  schema,
  sandbox,
  checkHolder,
  onDone,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  country: { code: string; fiat: string; name: string }
  schema: FormSchema | null | undefined
  sandbox: boolean
  checkHolder: (form: Record<string, unknown>) => Promise<string | null>
  onDone: (recipient: NewRecipient) => void
}) {
  const props = schema?.properties ?? {}
  const banks = props.BankDetails?.properties?.Bank?.enum ?? []
  const needsName = Boolean(props.AccountHolderName)
  const needsEmail = Boolean(props.Email)
  const needsPhone = Boolean(props.PhoneNumber)
  const needsAddress = Boolean(props.AccountHolderAddress)
  /** Where the bank names the holder itself (Nigeria), it's asked instead of typed. */
  const bankNames = !needsName

  const [picking, setPicking] = useState(false)
  const [query, setQuery] = useState("")
  const [bank, setBank] = useState("")
  const [number, setNumber] = useState("")
  const [type, setType] = useState<"Individual" | "Business">("Individual")
  const [first, setFirst] = useState("")
  const [last, setLast] = useState("")
  const [business, setBusiness] = useState("")
  const [email, setEmail] = useState("")
  const [phone, setPhone] = useState("")
  const [address, setAddress] = useState("")
  const [city, setCity] = useState("")
  const [province, setProvince] = useState("")
  const [purpose, setPurpose] = useState<string>("Salary")
  const [other, setOther] = useState("")
  const [reference, setReference] = useState("")
  const [withReference, setWithReference] = useState(false)
  const [check, setCheck] = useState<Check>({ state: "idle" })

  // A fresh form each time it opens, or for another country.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset only on open or a country change.
  useEffect(() => {
    if (!open) return
    setPicking(false)
    setQuery("")
    setBank("")
    setNumber("")
    setFirst("")
    setLast("")
    setBusiness("")
    setEmail("")
    setPhone("")
    setAddress("")
    setCity("")
    setProvince("")
    setPurpose("Salary")
    setOther("")
    setReference("")
    setWithReference(false)
    setCheck({ state: "idle" })
  }, [open, country.code])

  // The bank's own answer for who holds the account, a moment after the tenth digit.
  const asked = useRef(0)
  useEffect(() => {
    if (!bankNames || !bank || !/^\d{10}$/.test(number)) {
      setCheck({ state: "idle" })
      return
    }
    const ticket = ++asked.current
    setCheck({ state: "checking" })
    const timer = setTimeout(() => {
      checkHolder({ BankDetails: { Bank: bank, AccountNumber: number } })
        .then((name) => {
          if (ticket !== asked.current) return
          if (name) fire("tick", { cue: "confirmed" })
          setCheck(name ? { state: "found", name } : { state: "none" })
        })
        .catch((error: unknown) => {
          if (ticket !== asked.current) return
          fire("fail", { cue: "error" })
          setCheck({
            state: "bad",
            text: error instanceof Error ? error.message : "The bank didn't answer. Try again.",
          })
        })
    }, 350)
    return () => clearTimeout(timer)
  }, [bank, number, bankNames, checkHolder])

  const purposeText = purpose === "Other" ? other.trim() : purpose
  const typedHolder =
    type === "Individual" ? `${first.trim()} ${last.trim()}`.trim() : business.trim()
  const holder = bankNames ? (check.state === "found" ? check.name : null) : typedHolder || null
  const complete =
    Boolean(bank) &&
    number.length >= 5 &&
    (!needsName ||
      (type === "Individual"
        ? first.trim().length >= 2 && last.trim().length >= 2
        : business.trim().length >= 2)) &&
    (!needsEmail || /.+@.+\..+/.test(email.trim())) &&
    (!needsPhone || phone.replace(/\D/g, "").length >= 7) &&
    (!needsAddress ||
      (address.trim().length >= 3 && city.trim().length >= 2 && province.trim().length >= 2)) &&
    purposeText.length > 0 &&
    (!bankNames || check.state === "found" || check.state === "none")

  // The banks most people use first, then every bank with a logo, then the rest, each alphabetically.
  const ordered = useMemo(() => {
    const popular = POPULAR_BANKS[country.code] ?? []
    const rank = (b: string) => {
      const i = popular.indexOf(b)
      return i >= 0 ? i : bankLogo(b) ? 1000 : 2000
    }
    return [...banks].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))
  }, [banks, country.code])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    return (q ? ordered.filter((b) => b.toLowerCase().includes(q)) : ordered).slice(0, 80)
  }, [ordered, query])

  function done() {
    const form: Record<string, unknown> = {
      BankDetails: { Bank: bank, AccountNumber: number },
      PaymentPurpose: purposeText,
      ...(reference.trim() ? { Reference: reference.trim() } : {}),
      ...(needsName
        ? {
            AccountHolderName: {
              AccountHolderType: type,
              Name:
                type === "Individual"
                  ? { FirstName: first.trim(), LastName: last.trim() }
                  : business.trim(),
            },
          }
        : {}),
      ...(needsEmail ? { Email: email.trim() } : {}),
      ...(needsPhone ? { PhoneNumber: phone.trim() } : {}),
      ...(needsAddress
        ? {
            AccountHolderAddress: {
              Address: address.trim(),
              City: city.trim(),
              State: province.trim(),
            },
          }
        : {}),
    }
    fire("tick", { cue: "step" })
    onDone({ form, holder, label: `${bank} ••${lastFour(number)}` })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={`Recipient in ${country.name}`}>
      {picking ? (
        <div className="flex min-h-0 flex-col gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPicking(false)}
              className="press grid size-10 shrink-0 place-items-center rounded-full bg-secondary"
              aria-label="Back"
            >
              <ArrowLeft className="size-4" />
            </button>
            <Field
              id="bank-search"
              placeholder={`Search ${banks.length} banks`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leading={<Search className="size-4 text-muted-foreground" />}
              autoFocus
            />
          </div>
          <ul className="-mx-2 flex flex-col overflow-y-auto">
            {shown.map((name) => (
              <li key={name}>
                <button
                  type="button"
                  onClick={() => {
                    setBank(name)
                    setPicking(false)
                    fire("tick", { cue: "step" })
                  }}
                  className={cn(
                    "press flex w-full items-center gap-3 rounded-[14px] px-2 py-2.5 text-left hover:bg-secondary",
                    bank === name && "bg-secondary",
                  )}
                >
                  <BankDisc name={name} size={36} />
                  <span className="flex-1 text-[15px] font-semibold">{titleCase(name)}</span>
                </button>
              </li>
            ))}
            {shown.length === 0 ? (
              <li className="px-2 py-6 text-center text-[15px] text-muted-foreground">
                No bank called “{query}”
              </li>
            ) : null}
          </ul>
        </div>
      ) : (
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (complete) done()
          }}
        >
          <div className="flex items-center gap-2 text-[14px] font-medium text-muted-foreground">
            <Flag code={country.code} size={20} />
            {country.name} · {FIAT_NAME[country.fiat] ?? country.fiat}
            {sandbox && country.code === "NG" ? (
              <button
                type="button"
                onClick={() => {
                  setBank(TEST_ACCOUNT.bank)
                  setNumber(TEST_ACCOUNT.number)
                }}
                className="press ml-auto inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1.5 text-[13px] font-semibold text-foreground"
              >
                <FlaskConical className="size-3.5" /> Test account
              </button>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setPicking(true)}
            disabled={!banks.length}
            className="press flex h-16 items-center gap-3 rounded-[16px] bg-input px-3 text-left"
          >
            {bank ? (
              <BankDisc name={bank} size={40} />
            ) : (
              <span className="grid size-10 place-items-center rounded-full bg-card">
                <Landmark className="size-5" />
              </span>
            )}
            <span className="flex-1 text-[17px] font-semibold">
              {bank ? titleCase(bank) : banks.length ? "Choose their bank" : "Loading banks…"}
            </span>
            <ChevronRight className="size-5 text-muted-foreground" />
          </button>

          <Field
            id="bank-number"
            label="Account number"
            inputMode="numeric"
            autoComplete="off"
            placeholder={bankNames ? "10 digits" : "Account number"}
            value={bankNames && /^\d{10}$/.test(number) ? groupNumber(number) : number}
            onChange={(e) => setNumber(e.target.value.replace(/\D/g, "").slice(0, 30))}
            className="font-mono text-[20px] tracking-[0.04em]"
            status={
              check.state === "checking"
                ? { kind: "checking", text: `Checking with ${titleCase(bank)}…` }
                : check.state === "bad"
                  ? { kind: "bad", text: check.text }
                  : { kind: "none" }
            }
          />
          {check.state === "found" ? (
            <div className="flex items-center gap-3 rounded-[16px] bg-matcha px-4 py-3 text-black">
              <BadgeCheck className="size-5 shrink-0" />
              <span className="flex-1 text-[16px] font-bold uppercase tracking-[0.02em]">
                {check.name}
              </span>
              <span className="text-[12px] font-semibold text-black/60">from the bank</span>
            </div>
          ) : null}

          {needsName ? (
            <>
              <Segmented
                label="Who holds it"
                value={type}
                onValueChange={(v) => setType(v as "Individual" | "Business")}
                options={[
                  { value: "Individual", label: "A person" },
                  { value: "Business", label: "A business" },
                ]}
              />
              {type === "Individual" ? (
                <div className="grid grid-cols-2 gap-2">
                  <Field
                    id="holder-first"
                    label="First name"
                    autoComplete="off"
                    value={first}
                    onChange={(e) => setFirst(e.target.value)}
                  />
                  <Field
                    id="holder-last"
                    label="Last name"
                    autoComplete="off"
                    value={last}
                    onChange={(e) => setLast(e.target.value)}
                  />
                </div>
              ) : (
                <Field
                  id="holder-business"
                  label="Business name"
                  autoComplete="off"
                  value={business}
                  onChange={(e) => setBusiness(e.target.value)}
                />
              )}
            </>
          ) : null}

          {needsEmail || needsPhone || needsAddress ? (
            <div className="flex flex-col gap-2">
              <span className="text-detail font-medium text-muted-foreground">
                Their contact details
              </span>
              <div className="grid grid-cols-2 gap-2">
                {needsEmail ? (
                  <Field
                    id="holder-email"
                    placeholder="Email"
                    type="email"
                    autoComplete="off"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                ) : null}
                {needsPhone ? (
                  <Field
                    id="holder-phone"
                    placeholder="Phone"
                    inputMode="tel"
                    autoComplete="off"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                ) : null}
              </div>
              {needsAddress ? (
                <>
                  <Field
                    id="holder-address"
                    placeholder="Street address"
                    autoComplete="off"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <Field
                      id="holder-city"
                      placeholder="Town"
                      autoComplete="off"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                    <Field
                      id="holder-province"
                      placeholder="Province"
                      autoComplete="off"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                    />
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-col gap-2">
            <span className="text-detail font-medium text-muted-foreground">What it's for</span>
            <div className="flex flex-wrap gap-2">
              {PURPOSES.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPurpose(p)}
                  aria-pressed={purpose === p}
                  className={cn(
                    "press rounded-full px-4 py-2 text-[14px] font-semibold",
                    purpose === p ? "bg-foreground text-background" : "bg-secondary",
                  )}
                >
                  {p}
                </button>
              ))}
            </div>
            {purpose === "Other" ? (
              <Field
                id="purpose-other"
                placeholder="What the payment is for"
                value={other}
                onChange={(e) => setOther(e.target.value)}
              />
            ) : null}
          </div>

          {withReference ? (
            <Field
              id="bank-reference"
              label="Reference on their statement"
              maxLength={180}
              value={reference}
              onChange={(e) => setReference(e.target.value)}
            />
          ) : (
            <button
              type="button"
              onClick={() => setWithReference(true)}
              className="self-start text-[14px] font-semibold text-shu-ink hover:underline"
            >
              Add a reference
            </button>
          )}

          <Button type="submit" disabled={!complete}>
            Use this account
          </Button>
        </form>
      )}
    </Sheet>
  )
}
