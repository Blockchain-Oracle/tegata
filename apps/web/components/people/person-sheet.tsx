"use client"

// Adding someone, and everything about one person afterwards: their link to share, where their pay
// lands (or a change waiting out its 24 hours), a NEAR account the owner can set, their details, payslips, remove.
import { Check, Copy, ExternalLink, Mail, Share2, Trash2 } from "lucide-react"
import Link from "next/link"
import { useEffect, useState } from "react"
import { BusinessSeal } from "@/components/brand/seal"
import { CustomerDisc } from "@/components/invoices/customer-picker"
import { AccountLink } from "@/components/kit/account-link"
import { Button } from "@/components/kit/button"
import { Field } from "@/components/kit/field"
import { viewDollars } from "@/components/kit/figure"
import { Skeleton, StatusPill } from "@/components/kit/states"
import { ChainPicker } from "@/components/people/chain-picker"
import {
  changesOn,
  DestinationMark,
  destinationWord,
  shortAddress,
} from "@/components/people/destination"
import { Sheet } from "@/components/shell/sheet"
import type { PaySlipRow, TeamPerson } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { usdUnits } from "@/lib/fiat"

const COPIED_MS = 1500

export interface PersonForm {
  name: string
  email: string
  role: string
  amount: string
}

const blank: PersonForm = { name: "", email: "", role: "", amount: "" }

const formOf = (person: TeamPerson): PersonForm => ({
  name: person.name,
  email: person.email ?? "",
  role: person.role ?? "",
  amount: viewDollars(person.amount).toFixed(2),
})

export function AddPersonSheet({
  open,
  onOpenChange,
  emailEnabled,
  saving,
  problem,
  onSave,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  emailEnabled: boolean
  saving: boolean
  problem: string | null
  onSave: (form: PersonForm) => void
}) {
  const [form, setForm] = useState<PersonForm>(blank)
  useEffect(() => {
    if (open) setForm(blank)
  }, [open])
  const invites = emailEnabled && form.email.trim().length > 0
  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Add person">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(form)
        }}
      >
        <PersonFields form={form} onForm={setForm} />
        <p className="text-detail text-muted-foreground">
          {invites
            ? "They get an email: you've been added to payroll, choose where your pay lands."
            : "You'll get their link to send. They sign in with this email and choose where pay lands."}
        </p>
        {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
        <Button type="submit" busy={saving} disabled={!form.name.trim() || !form.amount.trim()}>
          {invites ? (
            <>
              <Mail /> Add and invite
            </>
          ) : (
            "Add person"
          )}
        </Button>
      </form>
    </Sheet>
  )
}

function PersonFields({ form, onForm }: { form: PersonForm; onForm: (form: PersonForm) => void }) {
  return (
    <>
      <Field
        id="person-name"
        label="Name"
        value={form.name}
        maxLength={80}
        autoComplete="off"
        onChange={(e) => onForm({ ...form, name: e.target.value })}
      />
      <Field
        id="person-email"
        label="Email"
        type="email"
        value={form.email}
        maxLength={120}
        autoComplete="off"
        onChange={(e) => onForm({ ...form, email: e.target.value })}
      />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          id="person-role"
          label="Role (optional)"
          value={form.role}
          maxLength={60}
          onChange={(e) => onForm({ ...form, role: e.target.value })}
        />
        <Field
          id="person-amount"
          label="Pay per run"
          inputMode="decimal"
          leading={<span className="text-[17px] font-semibold text-text-3">$</span>}
          value={form.amount}
          placeholder="2,400"
          onChange={(e) => onForm({ ...form, amount: e.target.value })}
        />
      </div>
    </>
  )
}

export function PersonSheet({
  person,
  slips,
  onOpenChange,
  saving,
  problem,
  onSave,
  onSetAccount,
  settingAccount,
  accountProblem,
  onRemove,
  removing,
  onResendInvite,
  resending,
  resent,
  onSetChain,
  settingChain,
  business,
  network = "testnet",
}: {
  person: TeamPerson | null
  slips: PaySlipRow[] | undefined
  onOpenChange: (open: boolean) => void
  saving: boolean
  problem: string | null
  onSave: (form: PersonForm) => void
  onSetAccount: (accountId: string) => void
  settingAccount: boolean
  accountProblem: string | null
  onRemove: () => void
  removing: boolean
  /** Email the invite again; `resent` names where it went. */
  onResendInvite?: () => void
  resending?: boolean
  resent?: string | null
  /** Live: pay them on another chain through NEAR Intents. */
  onSetChain?: (choice: { route: string; address: string }) => void
  settingChain?: boolean
  /** The business, for the PAID seal on payslips. */
  business?: string
  network?: "testnet" | "mainnet"
}) {
  const [form, setForm] = useState<PersonForm>(blank)
  const [account, setAccount] = useState("")
  const [chainOpen, setChainOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  useEffect(() => {
    if (!person) return
    setForm(formOf(person))
    setAccount("")
    setConfirmRemove(false)
  }, [person])

  if (!person)
    return (
      <Sheet open={false} onOpenChange={onOpenChange} title="">
        {null}
      </Sheet>
    )
  const link =
    typeof window === "undefined"
      ? `/p/${person.token}`
      : `${window.location.origin}/p/${person.token}`
  const changed = JSON.stringify(form) !== JSON.stringify(formOf(person))

  const copy = async () => {
    await navigator.clipboard.writeText(link)
    fire("tick", { cue: "confirmed" })
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }
  const share = async () => {
    if (navigator.share) {
      await navigator
        .share({ title: "Choose where your pay lands", url: link })
        .catch(() => undefined)
    } else await copy()
  }

  return (
    <Sheet open onOpenChange={onOpenChange} title={person.name}>
      <div className="flex flex-col gap-5">
        <div className="flex items-center gap-3">
          <CustomerDisc name={person.name} size={52} />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[18px] font-semibold">{person.name}</span>
            <span className="truncate text-detail text-muted-foreground">
              {[person.role, `${usdUnits(person.amount)} a run`].filter(Boolean).join(" · ")}
            </span>
          </span>
        </div>

        <section className="flex flex-col gap-3 rounded-[16px] bg-secondary p-4">
          <span className="text-detail font-medium text-muted-foreground">
            Where their pay lands
          </span>
          {person.ready.state === "none" ? (
            <span className="text-[16px] font-semibold">
              {person.email ? "They haven't chosen yet" : "Nowhere yet: set an account below"}
            </span>
          ) : (
            <span className="flex items-center gap-2.5">
              <DestinationMark
                kind={person.ready.kind}
                route={person.ready.state === "ready" ? person.ready.route : null}
                size={32}
              />
              <span className="flex min-w-0 flex-col">
                <span className="text-[16px] font-semibold">
                  {destinationWord(
                    person.ready.kind,
                    person.ready.state === "ready" ? person.ready.route : null,
                  )}
                  {person.ready.state === "opening" ? " · getting ready" : ""}
                </span>
                {person.ready.accountId ? (
                  person.ready.kind === "chain" ? (
                    <span className="font-mono text-[13px] text-muted-foreground">
                      {shortAddress(person.ready.accountId)}
                    </span>
                  ) : (
                    <AccountLink
                      accountId={person.ready.accountId}
                      className="text-[13px] text-muted-foreground"
                    />
                  )
                ) : null}
              </span>
            </span>
          )}
          {person.pending ? (
            <StatusPill tone="warn" className="self-start">
              {destinationWord(person.pending.kind, person.pending.route)} from{" "}
              {changesOn(person.pending.activatesAt)}
            </StatusPill>
          ) : null}
          {person.email ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="paper" size="sm" onClick={copy}>
                {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy their link"}
              </Button>
              <Button variant="paper" size="sm" onClick={share}>
                <Share2 /> Share
              </Button>
              <Button variant="paper" size="sm" asChild>
                <a href={`/p/${person.token}`} target="_blank" rel="noreferrer">
                  <ExternalLink /> Open
                </a>
              </Button>
              {onResendInvite && person.ready.state === "none" ? (
                <Button variant="paper" size="sm" busy={resending} onClick={onResendInvite}>
                  {resent ? <Check /> : <Mail />}{" "}
                  {resent ? "Invite sent" : "Email the invite again"}
                </Button>
              ) : null}
            </div>
          ) : null}
          {resent ? <p className="text-detail text-muted-foreground">Sent to {resent}.</p> : null}
        </section>

        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            if (account.trim()) onSetAccount(account.trim())
          }}
        >
          <Field
            id="person-near"
            label="Pay a NEAR account instead"
            placeholder={network === "mainnet" ? "name.near" : "name.testnet"}
            value={account}
            autoComplete="off"
            spellCheck={false}
            onChange={(e) => setAccount(e.target.value)}
            status={accountProblem ? { kind: "bad", text: accountProblem } : { kind: "none" }}
          />
          <Button
            type="submit"
            variant="secondary"
            size="md"
            busy={settingAccount}
            disabled={!account.trim()}
          >
            Use this account
          </Button>
        </form>

        {onSetChain ? (
          chainOpen ? (
            <section className="flex flex-col gap-2">
              <span className="text-detail font-medium text-muted-foreground">
                Pay them on another chain
              </span>
              <ChainPicker
                busy={Boolean(settingChain)}
                onPick={(choice) => {
                  onSetChain(choice)
                  setChainOpen(false)
                }}
                initial={
                  person.ready.state === "ready" && person.ready.kind === "chain"
                    ? { route: person.ready.route, address: person.ready.accountId }
                    : undefined
                }
              />
            </section>
          ) : (
            <Button variant="secondary" size="md" onClick={() => setChainOpen(true)}>
              Pay them on another chain
            </Button>
          )
        ) : null}

        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            onSave(form)
          }}
        >
          <PersonFields form={form} onForm={setForm} />
          {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
          {changed ? (
            <Button type="submit" busy={saving}>
              Save
            </Button>
          ) : null}
        </form>

        <section className="flex flex-col gap-2">
          <span className="text-detail font-medium text-muted-foreground">Payslips</span>
          {slips === undefined ? (
            <Skeleton className="h-12 rounded-[12px]" />
          ) : slips.length === 0 ? (
            <span className="text-[15px] text-muted-foreground">
              No pay yet. Their first run adds one.
            </span>
          ) : (
            slips.map((slip) => (
              <Link
                key={slip.id}
                href={`/r/slip/${slip.id}`}
                className="press flex items-center gap-3 rounded-[12px] bg-secondary px-3 py-2.5 text-[15px] hover:bg-plate-pressed"
              >
                <BusinessSeal name={business ?? person.name} band="Paid" size={32} tilt={0} />
                <span className="flex-1">{slip.label}</span>
                <span className="tnum font-semibold">{usdUnits(slip.amount)}</span>
              </Link>
            ))
          )}
        </section>

        {confirmRemove ? (
          <div className="flex flex-col gap-2 rounded-[16px] bg-down-surface p-4">
            <p className="text-[15px] font-medium text-down">
              Remove {person.name}? They won't be in future runs. Their payslips stay.
            </p>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmRemove(false)}>
                Keep
              </Button>
              <Button size="sm" busy={removing} onClick={onRemove}>
                Remove
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" size="md" onClick={() => setConfirmRemove(true)}>
            <Trash2 /> Remove from team
          </Button>
        )}
      </div>
    </Sheet>
  )
}
