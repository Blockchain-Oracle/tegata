import { ArrowRight, ArrowUpRight } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { Diagram } from "@/components/diagram"
import { BUILT_ON, Mark, Marquee } from "@/components/marks"
import { Phone, Shot } from "@/components/phone"
import { Seal, Stage } from "@/components/seal"
import { Tile } from "@/components/tile"
import { DOCS, SITE } from "@/lib/site"

export const metadata: Metadata = {
  title: { absolute: `${SITE.name} docs: ${SITE.headline}` },
  description: SITE.subheadline,
}

/** The docs' front page, in the README's order: the promise, the problem, a real receipt, every feature, the map. */
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-[1240px] flex-col gap-24 px-4 pt-8 pb-24 sm:px-8">
      {/* The promise beside the real thing. */}
      <section className="grid items-center gap-10 lg:grid-cols-[1.05fr_1fr]">
        <div className="flex flex-col gap-6">
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-fd-border bg-fd-card px-3 py-1 text-[13px] font-semibold text-fd-muted-foreground">
            <Seal size={16} tilt={0} /> 手形 · {SITE.meaning}
          </span>
          <h1 className="display text-[3.4rem] leading-[0.92] sm:text-[4.6rem]">
            <span className="block">Get paid.</span>
            <span className="block">Pay your team.</span>
            <span className="block text-text-3">In exact dollars.</span>
          </h1>
          <p className="max-w-[46ch] text-[18px] text-fd-muted-foreground">{SITE.subheadline}</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href={DOCS.start}
              className="inline-flex h-12 items-center gap-2 rounded-[14px] bg-shu px-5 text-[16px] font-semibold text-black"
            >
              Start here <ArrowRight className="size-4" />
            </Link>
            <a
              href={`${SITE.app}/invoice/new`}
              className="inline-flex h-12 items-center gap-2 rounded-[14px] border border-fd-border bg-fd-card px-5 text-[16px] font-semibold"
            >
              Try an invoice, no sign-up <ArrowUpRight className="size-4" />
            </a>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-[14px] font-semibold text-fd-muted-foreground">
            {BUILT_ON.map((b) => (
              <span key={b.id} className="inline-flex items-center gap-1.5">
                <Mark id={b.id} name="" size={20} /> {b.name}
              </span>
            ))}
          </div>
        </div>
        <Stage className="px-6 pt-10 pb-0 sm:px-10">
          <div className="flex items-end justify-center gap-4 sm:gap-6">
            <Phone
              src="/shots/phone/home.webp"
              alt="Tegata Home on a phone: Abu Studio's $5.75 balance in USDC on NEAR, and its latest payments, each opening its receipt"
              eager
              className="w-[46%] translate-y-6"
            />
            <Phone
              src="/shots/phone/receipt.webp"
              alt="Receipt No. 0003 from Abu Studio: $0.30 for invoice INV-0001, stamped PAID, with its NEAR transaction"
              eager
              className="w-[46%] -translate-y-2"
            />
          </div>
        </Stage>
      </section>

      <section className="flex flex-col gap-3">
        <span className="text-center text-[13px] font-semibold text-fd-muted-foreground">
          Settled in USDC on NEAR · live NEAR Intents prices from other chains
        </span>
        <Marquee />
      </section>

      {/* The problem and the idea, the README's words. */}
      <section className="grid gap-10 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
          <h2 className="display text-[2.6rem] leading-none">The problem</h2>
          <p className="text-[17px] text-fd-muted-foreground">
            A small design studio sends a client abroad an invoice for $1,250.00. By card, that
            costs about $68 (2.9% + 30¢, plus 1.5% international and 1% conversion). By wire, $6.11
            just to receive it. In stablecoins, the studio has to ask which coin and chain the
            client holds, send an address for that exact chain, match the transfer by its amount,
            and buy that chain&apos;s token before the money can move again.
          </p>
        </div>
        <div className="flex flex-col gap-4">
          <h2 className="display text-[2.6rem] leading-none">The idea</h2>
          <p className="text-[17px] text-fd-muted-foreground">
            The studio signs in with email and Tegata opens a NEAR account named after it, with no
            wallet and no NEAR to buy: Tegata pays every network fee. The client opens the invoice
            and pays in USDC on NEAR. The studio receives exactly $1,250.00, the invoice turns Paid
            when NEAR itself shows the transfer, and both sides get a sealed, numbered receipt.
          </p>
          <Link
            href={DOCS.money}
            className="inline-flex items-center gap-1.5 self-start text-[15px] font-semibold text-shu-ink"
          >
            How money moves <ArrowRight className="size-4" />
          </Link>
        </div>
      </section>

      {/* Every feature, each with its real screen. */}
      <section className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h2 className="display text-[2.6rem] leading-none">Everything in the Sandbox today</h2>
          <p className="max-w-[60ch] text-[17px] text-fd-muted-foreground">
            The whole app runs on NEAR testnet with test USDC, free. Every screen below is a real
            capture of the app on testnet.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Tile
            title="Invoices"
            line="Customers, items, discount and tax, part-payments, repeat invoices and a PDF."
            href={`${DOCS.guide}/invoices`}
            src="/shots/phone/guest-invoice-preview.webp"
            alt="An invoice from Studio Kaze to Northwind Ltd in the invoice builder's preview"
            field="bg-sakura"
            focus="50% 48%"
          />
          <Tile
            title="Pay links"
            line="One link for a fixed or any amount, with a QR code. Paid the moment NEAR settles it."
            href={`${DOCS.guide}/pay-links`}
            src="/shots/phone/link-detail.webp"
            alt="The pay link Studio test payment for $0.25 with Copy, Share and Open"
            field="bg-sora"
          />
          <Tile
            title="The pay page"
            line="Pay from a Tegata balance or any NEAR wallet; other chains show a live NEAR Intents price."
            href={`${DOCS.guide}/pay-page`}
            src="/shots/phone/pay-other-chain.webp"
            alt="The pay page for $0.25 with Another chain open: USDT on Tron, USDC on Base, Solana, Arbitrum and more"
            field="bg-matcha"
          />
          <Tile
            title="Receipts"
            line="A sealed receipt for every movement: payments, sends and rewards, each linked to NEAR."
            href={`${DOCS.guide}/receipts`}
            src="/shots/phone/receipt-send.webp"
            alt="A receipt stamped SENT for $15.00 sent from Abu Studio to tegata.testnet"
            field="bg-kin"
          />
          <Tile
            title="Pay people"
            line="Add your team by email or CSV. They choose where pay lands; one approval pays everyone."
            href={`${DOCS.guide}/pay-people`}
            src="/shots/phone/person-choose.webp"
            alt="A person's page: added to payroll, $20.00 a month, and where should your pay land"
            field="bg-matcha"
          />
          <Tile
            title="Send"
            line="Dollars to any NEAR account that can hold USDC, in one hold. Tegata pays the fee."
            href={`${DOCS.guide}/send`}
            src="/shots/phone/send.webp"
            alt="The Send screen: you send $0, you have $5.75, to a name.tegata.testnet account"
            field="bg-sora"
          />
          <Tile
            title="Referrals"
            line="Invite a business; you both get a reward once real customers pay it."
            href={`${DOCS.guide}/refer`}
            src="/shots/phone/refer.webp"
            alt="The Refer page: you both get $1, with Abu Studio's join link and its QR code"
            field="bg-sakura"
          />
        </div>
      </section>

      {/* A real receipt, then the map. */}
      <section className="grid items-center gap-10 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-4">
          <h2 className="display text-[2.6rem] leading-none">Paid means NEAR says so</h2>
          <p className="text-[17px] text-fd-muted-foreground">
            Every payment carries its own memo. Tegata marks it paid only when the final transaction
            on NEAR holds a USDC transfer to the business, for the full amount, with that memo.
            Nothing a browser says is believed. Money received another way can be marked paid by
            hand, and its receipt says so.
          </p>
          <Link
            href={`${DOCS.money}/paid`}
            className="inline-flex items-center gap-1.5 self-start text-[15px] font-semibold text-shu-ink"
          >
            When is it paid? <ArrowRight className="size-4" />
          </Link>
        </div>
        <Diagram
          name="payment"
          alt="One payment: the pay page starts an attempt with its memo; the customer pays from a Tegata balance or a NEAR wallet; the worker reads the final transaction and matches receiver, amount and memo, then marks it paid and numbers the receipt"
        />
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="display text-[2.6rem] leading-none">How it&apos;s built</h2>
        <Diagram
          name="system"
          alt="Tegata's parts: the web app, Postgres, and the worker that alone holds the operator keys, relays signed actions to NEAR and reads USDC events; live quotes come from NEAR Intents"
        />
        <Shot
          src="/shots/wide/guest-invoice.webp"
          alt="The invoice builder on a desktop: Studio Kaze billing Northwind Ltd $1,250.00, with the live invoice preview on the stage"
          caption="The invoice builder, open to anyone without an account: the invoice updates as you type."
          address="tegata.84.46.247.92.sslip.io/invoice/new"
        />
      </section>
    </main>
  )
}
