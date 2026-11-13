"use client"

// A receipt (plan 6.8 E, rule R1): a paper slip on the stage for every money movement, a customer payment (numbered,
// stamped PAID with the business seal), a send (stamped SENT) or a referral reward (Tegata's own seal), with the
// amount, who paid whom, how (with the real mark of the coin and chain), when, and the NEAR transaction that proves
// it. Share it, save it as a PDF, then NEAR. The slip itself is `ReceiptSlip`, shared with the pay page.
import { Check, ExternalLink, Printer, Share2 } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { BusinessSeal, SealPress, TegataSeal } from "@/components/brand/seal"
import { AccountLink, TxLink } from "@/components/kit/account-link"
import { viewDollars } from "@/components/kit/figure"
import { SandboxPill } from "@/components/kit/sandbox-pill"
import { Stage, StageObject } from "@/components/kit/stage"
import { Mark } from "@/components/marks/mark"
import { PaidWithMark } from "@/components/marks/paid-with"
import { ReceiptSlip, RouteLine, SlipRow as Row } from "@/components/receipt/receipt-slip"
import type { ReceiptView as Receipt } from "@/lib/client/types"
import { fire } from "@/lib/feedback"
import { coinAmount, usdUnits } from "@/lib/fiat"
import { routeOfAsset } from "@/lib/routes"

const COPIED_MS = 1500

const METHOD_WORD = {
  tegata: "Tegata balance",
  near_wallet: "NEAR wallet",
  oneclick: "Another chain",
  manual: "By hand · not on NEAR",
  reward: "Tegata referral rewards",
  payroll: "Payroll · Tegata balance",
  autopilot: "Autopilot on NEAR",
} as const

const FEE_WORD = { tegata: "Paid by Tegata", payer: "Paid by the payer" } as const

/** A dashed pill drawn for white paper, which stays light in both themes. */
const PAPER_PILL = "border-paper-text-3 py-0.5 text-[12px] text-paper-text-2"

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
    : null
  const sandbox = receipt.network === "testnet"
  const delivered = receipt.deliveredAs
  const deliveredSymbol = delivered?.route.split(" on ")[0] ?? ""

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
          <ReceiptSlip
            label={receipt.kind === "payslip" ? "Payslip" : `Receipt · ${number}`}
            amount={viewDollars(receipt.amount)}
            sub={
              <>
                <Mark id="usdc" chain="near" size={18} /> USDC on NEAR
                {sandbox ? <SandboxPill className={PAPER_PILL}>Sandbox</SandboxPill> : null}
              </>
            }
            seal={
              receipt.settledAt ? (
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
              ) : null
            }
          >
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
                <span className="tnum text-down">−{usdUnits(receipt.refunded)}</span>
              </Row>
            ) : null}
            <Row label="From">
              <Party name={receipt.payerName} account={receipt.payer} />
            </Row>
            <Row label="Paid with">
              <PaidWith receipt={receipt} />
            </Row>
            {delivered ? (
              <Row label="Delivered as">
                <span className="inline-flex items-center gap-1.5">
                  <Mark id={delivered.coin} chain={delivered.chainMark} size={18} />
                  {delivered.amount
                    ? `${coinAmount(delivered.amount, deliveredSymbol)} on ${delivered.route.split(" on ")[1] ?? ""}`
                    : delivered.route}
                </span>
              </Row>
            ) : null}
            {delivered || receipt.method === "oneclick" ? (
              <Row label="Converted by">
                <span className="inline-flex items-center gap-1.5">
                  <Mark id="intents" size={18} /> NEAR Intents
                </span>
              </Row>
            ) : null}
            {settled ? (
              <Row label="Settled">{settled}</Row>
            ) : (
              <Row label="Status">
                <span className="inline-flex items-center gap-1.5">
                  <span className="size-1.5 animate-pulse rounded-full bg-shu" /> Waiting for NEAR
                </span>
              </Row>
            )}
            {receipt.feeBy ? <Row label="Network fee">{FEE_WORD[receipt.feeBy]}</Row> : null}
            {receipt.txHash ? (
              <Row label="Transaction">
                <TxLink hash={receipt.txHash} network={receipt.network} className="text-[13px]" />
              </Row>
            ) : null}
            {delivered?.txUrl ? (
              <Row label={`On ${delivered.route.split(" on ")[1] ?? "their chain"}`}>
                <a
                  href={delivered.txUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-[13px] text-paper-seal hover:underline"
                >
                  Delivery transaction <ExternalLink className="size-3.5" />
                </a>
              </Row>
            ) : null}
          </ReceiptSlip>
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

/** How the money moved, with its real mark: the coin and chain it came from for NEAR Intents (audit S3). */
function PaidWith({ receipt }: { receipt: Receipt }) {
  if (receipt.method === "oneclick") {
    const route = routeOfAsset(receipt.assetIn)
    if (route)
      return (
        <RouteLine
          coin={route.coin}
          chainMark={route.chainMark}
          from={`${route.symbol} on ${route.chain}`}
        />
      )
  }
  const mark =
    receipt.method === "autopilot" ? (
      <Mark id="near" size={18} />
    ) : (
      <PaidWithMark
        rail={
          receipt.method === "near_wallet" ||
          receipt.method === "manual" ||
          receipt.method === "oneclick"
            ? receipt.method
            : "tegata"
        }
        size={18}
      />
    )
  return (
    <span className="inline-flex items-center gap-1.5">
      {mark}
      {receipt.method === "oneclick" && receipt.via
        ? `${receipt.via} → USDC on NEAR`
        : METHOD_WORD[receipt.method]}
    </span>
  )
}

/** A name over its account. A NEAR account opens on the explorer; another chain's address is shortened; mono is
 * only ever the account itself. */
function Party({ name, account }: { name: string | null; account: string | null }) {
  const isNear = account ? account.includes(".") || /^[0-9a-f]{64}$/.test(account) : false
  const shown = !account ? (
    <span>A payer</span>
  ) : isNear ? (
    <AccountLink accountId={account} className="justify-end text-[13px]" />
  ) : /\s/.test(account) || account.length < 20 ? (
    <span>{account}</span>
  ) : (
    <span className="font-mono text-[13px]" title={account}>
      {account.slice(0, 6)}…{account.slice(-4)}
    </span>
  )
  if (!name || name === account) return shown
  return (
    <span className="flex flex-col items-end">
      <span>{name}</span>
      <span className="text-[12px] font-medium text-paper-text-2">{shown}</span>
    </span>
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
