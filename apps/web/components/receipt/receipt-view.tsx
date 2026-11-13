"use client"

// A receipt (plan 6.8 E, rule R1): a paper slip on the stage for every money movement, a customer payment (numbered,
// stamped PAID with the business seal), a send (stamped SENT) or a referral reward (Tegata's own seal), with the
// amount, who paid whom, how, when, and the NEAR transaction that proves it. Share it, save it as a PDF, then NEAR.
import { Check, ExternalLink, Printer, Share2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { AccountLink, TxLink } from "@/components/kit/account-link"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Stage, StageObject } from "@/components/kit/stage"
import { RailMark } from "@/components/links/link-detail-view"
import { Mark } from "@/components/marks/mark"
import type { ReceiptView as Receipt } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const COPIED_MS = 1500

const METHOD_WORD = {
  tegata: "Tegata balance",
  near_wallet: "NEAR wallet",
  oneclick: "Another chain (NEAR Intents)",
  manual: "Marked paid by hand (not on NEAR)",
  reward: "Tegata referral rewards",
  payroll: "Payroll from a Tegata balance",
  autopilot: "Autopilot: Tegata's contract on NEAR",
} as const

const FEE_WORD = { tegata: "Paid by Tegata", payer: "Paid by the payer's wallet" } as const

export function ReceiptView({ receipt, token }: { receipt: Receipt; token: string }) {
  const [copied, setCopied] = useState(false)
  const number =
    receipt.number !== null
      ? `No. ${String(receipt.number).padStart(4, "0")}`
      : receipt.kind === "send"
        ? "Sent"
        : receipt.kind === "payslip"
          ? "Payslip"
          : "Reward"
  const tegata = receipt.kind === "reward"
  const settled = receipt.settledAt
    ? new Date(receipt.settledAt).toLocaleString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        // The reader's own clock, so it says which one: "12 Nov 2026, 17:40 GMT+1".
        timeZoneName: "short",
      })
    : "Settling"
  const sandbox = receipt.network === "testnet"

  const share = async () => {
    const url = window.location.href
    if (navigator.share) {
      await navigator
        .share({
          title: `${receipt.kind === "payslip" ? "Payslip" : `Receipt ${number}`} · ${receipt.business}`,
          url,
        })
        .catch(() => undefined)
      return
    }
    await navigator.clipboard.writeText(url)
    fire("tick", { cue: "confirmed" })
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }

  return (
    <div className="min-h-dvh bg-background print:bg-white">
      <Stage
        rounded={false}
        className="min-h-dvh print:min-h-0 print:bg-none"
        inner="flex flex-col items-center gap-6 px-4 py-8 sm:py-14"
      >
        <div className="flex items-center gap-3 print:hidden">
          <span className="grid size-12 place-items-center overflow-hidden rounded-full bg-white shadow-object">
            {receipt.logo ? (
              <img src={receipt.logo} alt="" className="size-full object-cover" />
            ) : tegata ? (
              <TegataSeal size={34} tilt={-4} />
            ) : (
              <BusinessSeal name={receipt.business} size={42} tilt={-4} />
            )}
          </span>
          <span className="flex flex-col">
            <span className="text-[14px] font-medium text-white/85">
              {receipt.kind === "payslip" ? "Payslip from" : "Receipt from"}
            </span>
            <span className="text-[18px] font-semibold text-white">{receipt.business}</span>
          </span>
        </div>

        <StageObject className="w-full max-w-[440px]" from={{ y: 28, rotate: -2 }} drift={false}>
          <article className="relative rounded-[20px] bg-white text-black shadow-receipt">
            <div className="p-6 pb-4">
              <span className="flex items-center gap-2 text-[13px] font-semibold text-[#666]">
                <TegataSeal size={20} textured={false} />{" "}
                {receipt.kind === "payslip" ? "Payslip" : `Receipt · ${number}`}
              </span>
              <Figure value={viewDollars(receipt.amount)} className="mt-3 flex text-[60px]" />
              <span className="mt-1 flex items-center gap-1.5 text-[14px] font-medium text-[#666]">
                <Mark id="usdc" chain="near" size={18} /> USDC on NEAR
                {sandbox ? " · Sandbox (testnet)" : ""}
              </span>
            </div>
            <div className="relative h-4">
              <span className="absolute top-1/2 -left-2 size-4 -translate-y-1/2 rounded-full bg-stage print:bg-white" />
              <span className="absolute top-1/2 -right-2 size-4 -translate-y-1/2 rounded-full bg-stage print:bg-white" />
              <span className="absolute inset-x-4 top-1/2 border-t-2 border-dashed border-[#E2E2E2]" />
            </div>
            <dl className="flex flex-col gap-3 p-6 pt-3 text-[14px]">
              <Row label="Paid to">
                <Party name={receipt.receiverName} account={receipt.receiverId} />
              </Row>
              <Row label="For">
                {receipt.forUrl ? (
                  <Link
                    href={receipt.forUrl}
                    className="underline decoration-current/30 decoration-dotted underline-offset-[3px] hover:decoration-solid"
                  >
                    {receipt.title}
                  </Link>
                ) : (
                  receipt.title
                )}
              </Row>
              {receipt.refunded ? (
                <Row label="Refunded">
                  <span className="text-down">−${viewDollars(receipt.refunded).toFixed(2)}</span>
                </Row>
              ) : null}
              <Row label="From">
                <Party name={receipt.payerName} account={receipt.payer ?? "A payer"} />
              </Row>
              <Row label="Paid with">
                <span className="inline-flex items-center gap-1.5">
                  <RailMark
                    rail={
                      receipt.method === "reward" ||
                      receipt.method === "payroll" ||
                      receipt.method === "autopilot"
                        ? "tegata"
                        : receipt.method
                    }
                    size={18}
                  />{" "}
                  {receipt.via ? `${receipt.via} → USDC on NEAR` : METHOD_WORD[receipt.method]}
                </span>
              </Row>
              {receipt.deliveredAs ? (
                <Row label="Delivered as">
                  <span className="inline-flex items-center gap-1.5">
                    <Mark
                      id={receipt.deliveredAs.coin}
                      chain={receipt.deliveredAs.chainMark}
                      size={18}
                    />
                    {receipt.deliveredAs.amount
                      ? `${receipt.deliveredAs.amount} ${receipt.deliveredAs.route}`
                      : receipt.deliveredAs.route}
                  </span>
                </Row>
              ) : null}
              {receipt.deliveredAs ? (
                <Row label="Converted by">
                  <span className="inline-flex items-center gap-1.5">
                    <Mark id="intents" size={18} /> NEAR Intents
                  </span>
                </Row>
              ) : null}
              <Row label="Settled">{settled}</Row>
              {receipt.feeBy ? <Row label="Network fee">{FEE_WORD[receipt.feeBy]}</Row> : null}
              {receipt.txHash ? (
                <Row label="Transaction">
                  <TxLink hash={receipt.txHash} network={receipt.network} className="text-[13px]" />
                </Row>
              ) : null}
              {receipt.deliveredAs?.txUrl ? (
                <Row label={`On ${receipt.deliveredAs.route.split(" on ")[1] ?? "their chain"}`}>
                  <a
                    href={receipt.deliveredAs.txUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[13px] text-[#B23700] hover:underline"
                  >
                    Delivery transaction <ExternalLink className="size-3.5" />
                  </a>
                </Row>
              ) : null}
            </dl>
            <div className="flex items-center justify-between gap-3 border-t border-[#ECECEC] px-6 py-4 text-[12px] font-medium text-[#666]">
              <span className="inline-flex items-center gap-1.5">
                <Mark id="near" size={14} /> Settled on NEAR
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Mark id="circle" size={14} /> USDC by Circle
              </span>
            </div>
            {receipt.settledAt ? (
              <div className="absolute top-4 right-4">
                <SealPress
                  delay={0.45}
                  onLanded={() => fire("filled", { cue: "stamp", identity: `receipt:${token}` })}
                >
                  {tegata ? (
                    <TegataSeal size={84} tilt={-8} />
                  ) : (
                    <BusinessSeal
                      name={receipt.business}
                      band={
                        receipt.kind === "send"
                          ? "Sent"
                          : receipt.refunded && receipt.refunded === receipt.amount
                            ? "Refunded"
                            : "Paid"
                      }
                      size={100}
                    />
                  )}
                </SealPress>
              </div>
            ) : null}
          </article>
        </StageObject>

        <div className="flex flex-wrap justify-center gap-2 print:hidden">
          <Pill onClick={share}>
            {copied ? <Check /> : <Share2 />} {copied ? "Link copied" : "Share"}
          </Pill>
          <Pill onClick={() => window.print()}>
            <Printer /> Save as PDF
          </Pill>
          {receipt.explorerUrl ? (
            <a
              href={receipt.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="press inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-semibold text-black shadow-object [&_svg]:size-4"
            >
              See it on NEAR <ExternalLink />
            </a>
          ) : null}
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 text-[14px] font-semibold text-white/90 hover:text-white print:hidden"
        >
          <span className="grid size-6 place-items-center rounded-full bg-white">
            <TegataSeal size={16} textured={false} tilt={0} />
          </span>
          Get paid in dollars with Tegata
        </Link>
      </Stage>
    </div>
  )
}

/** A name over its NEAR account, or the account alone when that is all there is. */
function Party({ name, account }: { name: string | null; account: string }) {
  // "A payer" (no account recorded) stays plain; a real NEAR account opens on the explorer.
  const isAccount = account.includes(".") || /^[0-9a-f]{64}$/.test(account)
  const shown = isAccount ? (
    <AccountLink accountId={account} className="justify-end text-[13px]" />
  ) : (
    <span className="font-mono text-[13px]">{account}</span>
  )
  if (!name || name === account) return shown
  return (
    <span className="flex flex-col items-end">
      <span>{name}</span>
      <span className="text-[12px] font-medium text-[#666]">{shown}</span>
    </span>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-[#666]">{label}</dt>
      <dd className="min-w-0 text-right font-semibold [overflow-wrap:anywhere]">{children}</dd>
    </div>
  )
}

function Pill({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="press inline-flex h-11 items-center gap-2 rounded-full bg-white px-4 text-[15px] font-semibold text-black shadow-object [&_svg]:size-4"
    >
      {children}
    </button>
  )
}
