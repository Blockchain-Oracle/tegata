"use client"

// Business → Emails: where the business's emails go, the ones the owner can switch off (security notices and money
// leaving always go), and the last emails Tegata sent for it, so "did they get it?" has an answer.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Lock, Mail } from "lucide-react"
import { Skeleton, StatusPill } from "@/components/kit/states"
import { Switch } from "@/components/kit/switch"
import { api } from "@/lib/client/api"
import { fire } from "@/lib/feedback"

interface EmailsView {
  to: string | null
  options: { kind: string; label: string; on: boolean }[]
  recent: { id: string; kind: string; to: string; status: string; at: string }[]
}

const KIND: Record<string, string> = {
  "payment.received": "You got paid",
  "payment.receipt": "Receipt to the payer",
  "invoice.sent": "Invoice",
  "invoice.reminder": "Invoice reminder",
  "invoice.void": "Invoice cancelled",
  "invoice.overdue": "Invoice overdue",
  "invoice.paid_by_hand": "Marked paid",
  "payroll.invite": "Payroll invite",
  "payroll.paid": "Payslip",
  "payroll.run": "Payroll run",
  "payroll.due": "Payroll due",
  "destination.pending": "Pay destination change",
  "destination.set": "Pay destination set",
  "team.invite": "Approver invite",
  "approval.needed": "Payroll needs approval",
  "autopilot.underfunded": "Autopilot short",
  "autopilot.on": "Autopilot on",
  "payout.delivered": "Delivered to another chain",
  "payout.returned": "Payout returned",
  "refund.sent": "Refund sent",
  "refund.received": "Refund to the payer",
  "send.sent": "Sent",
  "send.received": "Money received",
  "referral.paid": "Referral reward",
  "bank.paid": "Withdrawn to a bank",
  "bank.failed": "Bank withdrawal came back",
  "bank.received": "Bank transfer arrived",
  "referral.joined": "Someone joined with your link",
  "referral.qualified": "Referral qualified",
  "account.welcome": "Welcome",
  "account.live": "Live is on",
  "payin.refunded": "Payment refunded to payer",
  "apikey.created": "New API key",
  "webhook.failing": "Webhook failing",
  "statement.monthly": "Monthly statement",
}

/** An email kind we have no name for yet, said plainly: "payment.received" → "Payment received". */
function plainKind(kind: string): string {
  const words = kind.replace(/[._]+/g, " ").trim()
  return words ? words[0]!.toUpperCase() + words.slice(1) : "Email"
}

/** The emails that have no switch: they always go. */
const ALWAYS = ["Money leaving your balance", "Payroll", "Security notices"]

const TONE: Record<string, "up" | "down" | "wait" | "quiet"> = {
  sent: "up",
  queued: "wait",
  sending: "wait",
  skipped: "quiet",
  failed: "down",
}

export function EmailsCard({ businessName }: { businessName: string }) {
  const queryClient = useQueryClient()
  const view = useQuery({
    queryKey: ["business-emails"],
    queryFn: () => api<EmailsView>("/api/business/emails"),
    refetchInterval: 15_000,
  })
  const toggle = useMutation({
    mutationFn: (input: { kind: string; on: boolean }) =>
      api("/api/business/emails", { method: "PUT", body: input }),
    onMutate: ({ kind, on }) => {
      fire("tick", { cue: "toggle" })
      queryClient.setQueryData<EmailsView>(["business-emails"], (old) =>
        old
          ? { ...old, options: old.options.map((o) => (o.kind === kind ? { ...o, on } : o)) }
          : old,
      )
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: ["business-emails"] }),
  })
  const data = view.data
  return (
    <section className="flex flex-col gap-4 rounded-[24px] bg-card p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-full bg-sora text-field-ink">
          <Mail className="size-5" />
        </span>
        <div className="flex min-w-0 flex-col">
          <h2 className="text-[17px] font-semibold">Emails</h2>
          {data ? (
            <span className="truncate text-[15px] text-muted-foreground">
              {data.to ? (
                <>
                  Sent to <span className="font-medium text-foreground">{data.to}</span>
                </>
              ) : (
                "Add a billing email above to get them"
              )}
            </span>
          ) : (
            <Skeleton className="mt-1 h-4 w-48" />
          )}
        </div>
      </div>
      <div className="flex flex-col divide-y divide-secondary rounded-[16px] bg-secondary/60 px-4">
        {data
          ? data.options.map((o) => (
              <div key={o.kind} className="flex items-center justify-between gap-3 py-3">
                <span className="text-[15px] font-medium">{o.label}</span>
                <Switch
                  checked={o.on}
                  onCheckedChange={(on) => toggle.mutate({ kind: o.kind, on })}
                  label={o.label}
                />
              </div>
            ))
          : [0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between gap-3 py-3.5">
                <Skeleton className="h-4 w-[52%]" />
                <Skeleton className="h-6 w-10 rounded-full" />
              </div>
            ))}
        {ALWAYS.map((label) => (
          <div key={label} className="flex items-center justify-between gap-3 py-3">
            <span className="text-[15px] font-medium">{label}</span>
            <span className="inline-flex items-center gap-1.5 text-detail font-semibold text-muted-foreground">
              <Lock className="size-3.5" /> Always
            </span>
          </div>
        ))}
      </div>
      <p className="text-detail text-muted-foreground">
        Customers and your people get theirs from “{businessName} via Tegata”.
      </p>
      {data?.recent.length ? (
        <div className="flex flex-col gap-2">
          <span className="text-detail font-medium text-muted-foreground">Recently</span>
          <ul className="flex flex-col divide-y divide-secondary rounded-[16px] bg-secondary/60 px-4">
            {data.recent.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex min-w-0 flex-col">
                  <span className="text-[14px] font-semibold">
                    {KIND[e.kind] ?? plainKind(e.kind)}
                  </span>
                  <span className="truncate text-detail text-muted-foreground">
                    {e.to} ·{" "}
                    {new Date(e.at).toLocaleString(undefined, {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </span>
                <StatusPill tone={TONE[e.status] ?? "quiet"}>
                  {e.status === "sent"
                    ? "Sent"
                    : e.status === "failed"
                      ? "Failed"
                      : e.status === "skipped"
                        ? "Off"
                        : "Sending"}
                </StatusPill>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}
