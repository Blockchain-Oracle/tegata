// Everything else a business needs (DESIGN.md "The landing page" §9): the Magic UI bento, one tile per surface of
// the app, each with a small picture of the real thing. Cards say "Opening soon" because they are.
import { Check, FileText, Send } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"

import { BusinessSeal, TegataSeal } from "@/components/brand/seal"
import { GRAIN, Paper, Stage } from "@/components/kit/stage"
import { Mark, MarkStack } from "@/components/marks/mark"
import { BentoCard, BentoGrid } from "@/components/ui/bento-grid"
import { LINKS } from "@/lib/links"
import { cn } from "@/lib/utils"

import { RunningHead, SectionTitle } from "./section"

function Top({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("absolute inset-x-0 top-0 h-[60%] overflow-hidden", className)}>
      {children}
    </div>
  )
}

function Grain() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 opacity-[0.22] mix-blend-overlay"
      style={{ backgroundImage: GRAIN }}
    />
  )
}

const PAID = [
  { amount: "$480.00", from: "usdc", chain: "base", note: "USDC on Base" },
  { amount: "$1,250.00", from: "near", chain: undefined, note: "A NEAR wallet" },
  { amount: "$65.00", from: "usdt", chain: "tron", note: "USDT on Tron" },
]

function LinksArt() {
  return (
    <Top className="bg-sora">
      <Grain />
      <div className="absolute top-8 left-6 transition-transform duration-500 group-hover:-rotate-2 sm:left-10">
        <Paper className="flex items-center gap-4 p-3 pr-5">
          <div className="rounded-[10px] bg-white p-1">
            <QRCodeSVG value="https://tegata.xyz" size={78} fgColor="#16130F" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-semibold text-paper-text-2">
              Pay link · any amount
            </span>
            <span className="figure text-[30px] leading-none">Studio work</span>
            <span className="font-mono text-[12px] text-paper-text-2">tegata.xyz/pay/…</span>
          </div>
        </Paper>
      </div>
      <div className="absolute top-6 right-6 hidden w-[260px] flex-col gap-2 sm:flex">
        {PAID.map((p, i) => (
          <div
            key={p.amount}
            className="flex items-center gap-3 rounded-[14px] bg-white/85 px-3 py-2 text-black backdrop-blur-sm transition-transform duration-500 group-hover:translate-x-[-6px]"
            style={{ transitionDelay: `${i * 60}ms` }}
          >
            <Mark id={p.from} chain={p.chain} size={26} />
            <span className="flex flex-1 flex-col">
              <span className="text-[13px] font-semibold">Paid · {p.amount}</span>
              <span className="text-[11px] text-[#5B544A]">{p.note}</span>
            </span>
            <Check className="size-4 text-[#2F7A00]" strokeWidth={3} />
          </div>
        ))}
      </div>
    </Top>
  )
}

function CounterArt() {
  return (
    <Top>
      <Stage className="size-full" rounded={false} tone="paid" inner="grid place-items-center">
        <div className="relative">
          <Paper className="p-3">
            <QRCodeSVG value="https://tegata.xyz" size={104} fgColor="#16130F" />
          </Paper>
          <div className="absolute -right-10 -bottom-6 transition-transform duration-500 group-hover:scale-105">
            <BusinessSeal name="Your shop" band="Paid" size={74} />
          </div>
        </div>
      </Stage>
    </Top>
  )
}

function ApiArt() {
  return (
    <Top className="bg-[#16130F]">
      <pre className="p-5 font-mono text-[12px] leading-[1.65] text-[#E9E3D6]">
        <span className="text-[#968C7F]">$</span> curl tegata.xyz/api/v1/checkout/sessions \{"\n"}
        {"  "}-H <span className="text-[#C8F06A]">"Authorization: Bearer $TEGATA_KEY"</span> \{"\n"}
        {"  "}-d{" "}
        <span className="text-[#C8F06A]">
          '{"{"}"amount": "25.00"{"}"}'
        </span>
        {"\n\n"}
        <span className="text-[#968C7F]">→ webhook</span>{" "}
        <span className="text-[#FF8A52]">checkout.session.completed</span>
        {"\n"}
        <span className="text-[#968C7F]">→ signature</span>{" "}
        <span className="text-[#B5F543]">valid</span>
      </pre>
    </Top>
  )
}

const CSV = [
  ["12 Nov", "Payment", "+1,250.00", "Paid"],
  ["12 Nov", "Payroll run", "−5,180.00", "Paid"],
  ["13 Nov", "Sent to a NEAR account", "−300.00", "Paid"],
]

function BooksArt() {
  return (
    <Top className="bg-matcha">
      <Grain />
      <div className="absolute top-7 left-6 right-6 sm:left-10 sm:right-auto sm:w-[440px]">
        <Paper className="overflow-hidden p-0 text-[13px]">
          <div className="flex items-center justify-between border-b border-paper-rule px-4 py-2.5 font-semibold text-paper-text-2">
            <span>november.csv</span>
            <span className="inline-flex items-center gap-1">
              <Mark id="near" size={14} /> Checked against NEAR
            </span>
          </div>
          {CSV.map((r) => (
            <div
              key={r[1]}
              className="grid grid-cols-[52px_1fr_auto] gap-3 border-b border-paper-rule px-4 py-2 whitespace-nowrap last:border-0 sm:grid-cols-[64px_1fr_auto_56px]"
            >
              <span className="text-paper-text-2">{r[0]}</span>
              <span className="truncate font-medium">{r[1]}</span>
              <span
                className={cn(
                  "tnum text-right font-semibold",
                  r[2]!.startsWith("+") ? "text-[#2F7A00]" : "",
                )}
              >
                {r[2]}
              </span>
              <span className="hidden text-right text-paper-text-2 sm:inline">{r[3]}</span>
            </div>
          ))}
        </Paper>
      </div>
      <div className="absolute top-12 right-8 hidden rotate-[5deg] transition-transform duration-500 group-hover:rotate-[2deg] md:block">
        <Paper className="flex w-[150px] flex-col items-center gap-2 p-4">
          <FileText className="size-8 text-[#5B544A]" />
          <span className="text-center text-[13px] font-semibold">November statement.pdf</span>
        </Paper>
      </div>
    </Top>
  )
}

function SendArt() {
  return (
    <Top className="bg-sakura">
      <Grain />
      <div className="grid size-full place-items-center">
        <div className="flex items-center gap-3">
          <span className="grid size-16 place-items-center rounded-full bg-white">
            <TegataSeal size={38} textured={false} />
          </span>
          <Send className="size-6 text-foreground/60 transition-transform duration-500 group-hover:translate-x-1" />
          <MarkStack ids={["near", "usdt", "usdc", "btc"]} size={44} />
        </div>
      </div>
    </Top>
  )
}

function WalletArt() {
  return (
    <Top className="bg-ai">
      <div className="grid size-full place-items-center">
        <div className="flex w-[220px] flex-col gap-2 rounded-[18px] bg-white/10 p-3 text-white backdrop-blur-sm">
          <span className="text-[12px] font-semibold text-white/70">Sign in</span>
          <span className="flex items-center gap-2 rounded-[12px] bg-white px-3 py-2.5 text-[14px] font-semibold text-black">
            <Mark id="near" size={22} /> Continue with a NEAR wallet
          </span>
          <span className="rounded-[12px] bg-white/15 px-3 py-2.5 text-[14px] font-semibold">
            Continue with email
          </span>
        </div>
      </div>
    </Top>
  )
}

function CardsArt() {
  return (
    <Top className="bg-kin">
      <Grain />
      <div className="grid size-full place-items-center">
        <div className="relative h-[120px] w-[190px]">
          <div className="absolute inset-0 translate-x-5 -translate-y-3 rotate-[8deg] rounded-[16px] bg-[#16130F]" />
          <div className="absolute inset-0 flex flex-col justify-between rounded-[16px] bg-shu p-3.5 transition-transform duration-500 group-hover:-rotate-3">
            <div className="flex items-center justify-between">
              <TegataSeal size={26} tone="paper" textured={false} />
              <span className="text-[11px] font-semibold text-black/70">Team</span>
            </div>
            <div className="flex items-end justify-between">
              <span className="font-mono text-[12px] text-black/80">•••• 4021</span>
              <img src="/marks/visa-white.svg" alt="" className="h-4 w-auto" />
            </div>
          </div>
        </div>
      </div>
    </Top>
  )
}

export function Features() {
  return (
    <section
      id="features"
      className="mx-auto max-w-[1240px] scroll-mt-24 px-5 pt-24 sm:px-8 lg:pt-32"
    >
      <RunningHead n="06" label="Everything else" />
      <SectionTitle className="mt-8 max-w-[15ch]">
        The rest of the money desk. <span className="text-text-3">All on one balance.</span>
      </SectionTitle>
      <BentoGrid className="mt-10 auto-rows-[24rem]">
        <BentoCard
          className="lg:col-span-2"
          name="Pay links and QR codes"
          description="A link for a fixed or any amount, with a QR to print. Payments appear on it the moment NEAR settles them."
          href="/signin"
          cta="Make a link"
          background={<LinksArt />}
        />
        <BentoCard
          name="A counter for in-person sales"
          description="Type an amount, show the QR. It turns green with your seal when the payment settles."
          href="/signin"
          cta="Open the counter"
          background={<CounterArt />}
        />
        <BentoCard
          name="Checkout for your own site"
          description="One curl makes a checkout session; signed webhooks tell your server when it's paid."
          href={`${LINKS.docs}/docs/build/developers`}
          cta="Read the API"
          background={<ApiArt />}
        />
        <BentoCard
          className="lg:col-span-2"
          name="Books your accountant can open"
          description="Every movement with who, what, when and how. A CSV and a statement PDF each month, and the books checked against NEAR, transfer by transfer."
          href={`${LINKS.docs}/docs`}
          cta="How the books work"
          background={<BooksArt />}
        />
        <BentoCard
          name="Send to anyone"
          description="Dollars to any NEAR account in one hold, or in Live to an address on another chain, in the coin they want."
          href="/signin"
          cta="Send money"
          background={<SendArt />}
        />
        <BentoCard
          name="Bring your own NEAR wallet"
          description="Sign in with a wallet through NEAR Connect; every approval is one prompt, and still gas-free."
          href="/signin"
          cta="Sign in with a wallet"
          background={<WalletArt />}
        />
        <BentoCard
          name="Cards for your team"
          pill="Opening soon"
          description="Virtual Visa cards for you and your people, each filled from your balance, with limits and freeze."
          href={`${LINKS.docs}/docs`}
          cta="Read about cards"
          background={<CardsArt />}
        />
      </BentoGrid>
    </section>
  )
}
