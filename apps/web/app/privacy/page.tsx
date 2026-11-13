// /privacy: Tegata's privacy policy, for the web app, the iPhone and Android apps and Apple's TestFlight review.
// Written from what Tegata actually stores (packages/db/src/schema) and the partners it calls; when either changes,
// change this page and its date. Plain words, short sections, the facts first.
import { ArrowRight } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import type { ReactNode } from "react"

import { Lockup } from "@/components/brand/seal"
import { buttonVariants } from "@/components/kit/button-variants"
import { Stage } from "@/components/kit/stage"
import { Mark } from "@/components/marks/mark"

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What Tegata collects, what is public on NEAR, who it shares data with, and how to delete your account.",
}

const UPDATED = "13 November 2026"
/** Where privacy questions and deletion requests go. */
const CONTACT = "privacy@tegata.xyz"

const IN_SHORT = [
  [
    "No ads, no trackers",
    "Tegata has no advertising and no analytics scripts, on the web or in the apps.",
  ],
  ["Never sold", "Your data is used to run Tegata and is never sold or rented."],
  ["Payments are public on NEAR", "Like any blockchain, NEAR shows transfers to anyone who looks."],
  ["Yours to delete", "Ask and we delete your account; what is on NEAR stays on NEAR."],
] as const

const PARTNERS: { name: string; mark?: string; does: string }[] = [
  {
    name: "Privy",
    does: "Email sign-in. It sends your code and holds the key that signs your payments.",
  },
  { name: "NEAR", mark: "near", does: "The network where every payment settles, in public." },
  {
    name: "NEAR Intents",
    mark: "intents",
    does: "Payments from and to other chains. It sees the amount, the coin and the address involved.",
  },
  {
    name: "Resend",
    does: "Sends Tegata's emails: codes, invoices, receipts, payslips and notices.",
  },
  {
    name: "Noah",
    does: "Bank payouts and bank details, only if you use them. It receives the bank details you enter.",
  },
  {
    name: "Bitnob",
    does: "Cards, only if you open one. It receives what is needed to issue the card.",
  },
  {
    name: "Transak",
    does: "Paying by card on a pay page, only if the payer chooses it. It receives the payer's details and IP address.",
  },
  {
    name: "Reown",
    does: "Connects a payer's own wallet on a pay page, only if the payer chooses it.",
  },
]

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-section-title font-semibold">{title}</h2>
      <div className="flex flex-col gap-3 text-[16px] leading-[1.6] text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  )
}

function List({ items }: { items: readonly ReactNode[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: a fixed list.
        <li key={i} className="flex gap-3">
          <span className="mt-[11px] size-1.5 shrink-0 rounded-full bg-shu" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

export default function PrivacyPage() {
  return (
    <main className="min-h-dvh bg-background">
      <header className="mx-auto flex max-w-[1080px] items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label="Tegata home">
          <Lockup size={32} />
        </Link>
        <Link href="/signin" className={buttonVariants({ size: "sm" })}>
          Open Tegata
        </Link>
      </header>

      <div className="mx-auto flex max-w-[1080px] flex-col gap-10 px-5 pb-20 sm:px-8">
        <Stage tone="lacquer" className="px-6 py-10 sm:px-10 sm:py-12">
          <div className="flex flex-col gap-8">
            <div className="flex flex-col gap-3">
              <span className="text-[14px] font-medium text-white/75">Updated {UPDATED}</span>
              <h1 className="display text-[48px] leading-[0.95] text-white sm:text-[64px]">
                Privacy
              </h1>
              <p className="max-w-[52ch] text-[17px] text-white/85">
                What Tegata keeps to run your business's money, and what it never does with it.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {IN_SHORT.map(([title, line]) => (
                <div
                  key={title}
                  className="rounded-[20px] bg-paper p-5 text-[#16130F] shadow-object"
                >
                  <p className="text-[17px] font-semibold">{title}</p>
                  <p className="mt-1 text-[15px] text-paper-text-2">{line}</p>
                </div>
              ))}
            </div>
          </div>
        </Stage>

        <div className="mx-auto flex w-full max-w-[68ch] flex-col gap-10">
          <Section title="Who we are">
            <p>
              Tegata (tegata.xyz) lets a small business get paid and pay its people in dollars,
              settled as USDC on NEAR. This policy covers the website, the iPhone and Android apps,
              the pay pages your customers open and the emails Tegata sends.
            </p>
          </Section>

          <Section title="What we collect">
            <List
              items={[
                <>
                  <strong>To sign you in:</strong> your email address and the public key of your
                  NEAR signing key. The key itself stays with Privy; Tegata never sees it.
                </>,
                <>
                  <strong>About your business:</strong> what you enter: its name, logo, address, tax
                  number, email and time zone, and your pay address (name.tegata.near).
                </>,
                <>
                  <strong>People and customers you add:</strong> their names, emails, roles, pay
                  amounts and where their pay lands. You are responsible for having their permission
                  to add them.
                </>,
                <>
                  <strong>Money records:</strong> invoices, pay links, payments, sends, payroll
                  runs, payslips, refunds and receipts, with the NEAR transactions behind them.
                </>,
                <>
                  <strong>From payers:</strong> the wallet or address they paid from, and an email
                  only if they ask for a receipt.
                </>,
                <>
                  <strong>If you use them:</strong> bank details for payouts, card details for
                  cards, and API keys and webhook addresses for developers.
                </>,
                <>
                  <strong>Server logs:</strong> our servers record requests (time, page, IP address)
                  to keep Tegata secure and working. We don't use them to profile you.
                </>,
              ]}
            />
          </Section>

          <Section title="What is public on NEAR">
            <p>
              Every payment settles on NEAR, a public blockchain. Anyone can see a transfer's
              accounts, amount, time and memo, including your pay address and the payments into and
              out of it. Tegata can't hide or delete what is on NEAR. The memos Tegata writes carry
              reference numbers, never names or emails; a note you add to a send is written on NEAR
              as you typed it.
            </p>
            <p className="inline-flex items-center gap-2">
              <Mark id="near" size={18} /> Sandbox uses NEAR testnet with test dollars; Live uses
              NEAR mainnet.
            </p>
          </Section>

          <Section title="Who we share it with">
            <p>Only the services that make Tegata work, each with only what it needs:</p>
            <div className="flex flex-col rounded-[20px] bg-card p-2">
              {PARTNERS.map((partner) => (
                <div key={partner.name} className="flex gap-3 rounded-[14px] px-3 py-3">
                  <span className="grid size-8 shrink-0 place-items-center">
                    {partner.mark ? <Mark id={partner.mark} size={24} /> : null}
                  </span>
                  <span className="flex flex-col">
                    <span className="text-[16px] font-semibold text-foreground">
                      {partner.name}
                    </span>
                    <span className="text-[15px]">{partner.does}</span>
                  </span>
                </div>
              ))}
            </div>
            <p>
              We share data with authorities only when the law requires it. We don't sell or rent
              data, and nothing goes to advertisers or data brokers.
            </p>
          </Section>

          <Section title="On your phone">
            <List
              items={[
                <>
                  <strong>Camera:</strong> only while you scan a code to pay. Nothing is recorded or
                  uploaded.
                </>,
                <>
                  <strong>On the device:</strong> your sign-in session (in the phone's secure
                  storage), the mode you chose and your sound and haptics switches.
                </>,
                <>No contacts, location, photos, microphone or tracking across other apps.</>,
              ]}
            />
          </Section>

          <Section title="How long we keep it">
            <p>
              As long as your account is open. Money records may be kept longer where the law
              requires a business to keep its books. Server logs are kept briefly.
            </p>
          </Section>

          <Section title="Your choices">
            <List
              items={[
                <>See and download your records any time (Activity and the CSV export).</>,
                <>Change your business details in Business settings.</>,
                <>
                  Ask for a copy of your data, or for your account to be deleted, at{" "}
                  <a
                    href={`mailto:${CONTACT}`}
                    className="font-semibold text-shu-ink hover:underline"
                  >
                    {CONTACT}
                  </a>
                  . We answer within 30 days.
                </>,
              ]}
            />
          </Section>

          <Section title="Children">
            <p>
              Tegata is for businesses and the people they pay. It isn't meant for anyone under 18.
            </p>
          </Section>

          <Section title="Changes">
            <p>
              When this policy changes, the date at the top changes too. If a change matters to how
              your data is used, we tell you by email first.
            </p>
          </Section>

          <div className="flex flex-wrap gap-2 pt-2">
            <Link href="/signin" className={buttonVariants({ size: "lg" })}>
              Open Tegata <ArrowRight />
            </Link>
            <Link href="/download" className={buttonVariants({ variant: "secondary", size: "lg" })}>
              Get the app
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
