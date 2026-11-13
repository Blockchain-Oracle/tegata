// Proof on NEAR (DESIGN.md "The landing page" §10): a line that inks in as you scroll (Magic UI text reveal), then
// a ledger of real testnet transactions from the README, each opening on the explorer, and the measured costs.
import { ArrowUpRight } from "lucide-react"

import { Mark } from "@/components/marks/mark"
import { TextReveal } from "@/components/ui/text-reveal"

import { Rise, RunningHead } from "./section"

const TX = "https://testnet.nearblocks.io/txns/"

const LEDGER = [
  {
    what: "An account holding 0 NEAR moved a token; Tegata's operator paid the 0.00029 NEAR fee",
    tx: "8oDoAfrPgHFRKW7jKKGzHmURxmErFTHYLVhByrzp9Bxk",
  },
  {
    what: "INV-0001 paid in two parts, $0.20 then $0.30; a $0.40 attempt in between was refused",
    tx: "4DaV5LVezTYavbjzQdfsSUcMYL1Yiz59z5Z4TyFQCquE",
  },
  {
    what: "One approval paid a person's Tegata account and another's NEAR account, all-or-nothing",
    tx: "7hEg9DgZdEaq7e4AHtY9FZ4ReB3sveq5XwewiEanCKFr",
  },
  {
    what: "Team approvals: the second approver's yes paid both rows from the team's Sputnik DAO treasury, in one batch",
    tx: "6KLZFaa87enrDSbh9hn9yoChVSf7TbvEcGEXi2JyJ6by",
  },
  {
    what: "Autopilot: after payday, with nobody online, one run paid three people",
    tx: "DrvyRxFLWQjYRr9xMgbPXZ2qSW2hwrZNMLrShYUTvvUb",
  },
  {
    what: "A checkout session made by curl, paid from a NEAR account, two signed webhooks verified",
    tx: "6tmnGKULQVyUUeGdpWNQYLNWCrCCmiv4iqQtsimSnBnF",
  },
  {
    what: "A NEAR wallet signed in with its own key and sent 0.05 with a delegate action, relayed gas-free",
    tx: "8PWgsYjeTMFY7WVkgWNBqcSnRwfQqPoAazsNeaFnXRo7",
  },
  {
    what: "A simulated €2.00 bank transfer to a business's euro account arrived as 1.16 USDC",
    tx: "CGQr6SEf3P5spDqohfH91PGCMABGjA1RGDpiYyczHe6F",
  },
]

const MEASURED = [
  { n: "0", unit: "NEAR", label: "held by every user account" },
  { n: "0.0003", unit: "NEAR", label: "fee per relayed action, paid by Tegata" },
  { n: "0.008", unit: "NEAR", label: "to open a business account" },
  { n: "50", unit: "", label: "payroll transfers in one transaction" },
]

export function Proof() {
  return (
    <section id="proof" className="scroll-mt-24 pt-24 lg:pt-32">
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        <RunningHead n="07" label="Proof on NEAR" />
      </div>
      <TextReveal className="h-[170vh]">Nothing is paid until NEAR says so.</TextReveal>
      <div className="mx-auto -mt-[30vh] max-w-[1240px] px-5 sm:px-8">
        <Rise className="grid grid-cols-2 gap-x-6 gap-y-8 border-y border-rule py-8 lg:grid-cols-4">
          {MEASURED.map((m) => (
            <div key={m.label} className="flex flex-col gap-1">
              <span className="figure text-[clamp(44px,5.4vw,72px)] leading-none">
                {m.n}
                {m.unit ? <span className="ml-1.5 text-[0.45em] text-text-3">{m.unit}</span> : null}
              </span>
              <span className="text-[14px] text-muted-foreground">{m.label}</span>
            </div>
          ))}
        </Rise>
        <div className="mt-10 flex flex-col">
          <div className="mb-3 flex items-center justify-between text-[13px] font-semibold text-text-3">
            <span className="inline-flex items-center gap-2">
              <Mark id="near" size={18} /> Recorded on NEAR testnet
            </span>
            <span className="hidden sm:inline">Transaction</span>
          </div>
          {LEDGER.map((row, i) => (
            <Rise key={row.tx} delay={i * 0.03}>
              <a
                href={`${TX}${row.tx}`}
                target="_blank"
                rel="noreferrer"
                className="group grid gap-2 border-t border-rule py-4 transition-colors hover:bg-card sm:grid-cols-[1fr_auto] sm:items-center sm:gap-6 sm:px-3"
              >
                <span className="text-[16px] leading-snug">{row.what}</span>
                <span className="inline-flex items-center gap-1.5 font-mono text-[14px] text-shu-ink">
                  {row.tx.slice(0, 6)}…
                  <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </span>
              </a>
            </Rise>
          ))}
          <p className="border-t border-rule pt-4 text-[14px] text-muted-foreground">
            Live, on NEAR mainnet, is switched on as <span className="font-mono">tegata.near</span>.
            Every proof here is on testnet so far. Each one can be re-run from the repository.
          </p>
        </div>
      </div>
    </section>
  )
}
