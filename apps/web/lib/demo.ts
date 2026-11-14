// What /demo shows: the film (on YouTube, played on the page), its chapters, five moments from it and the NEAR
// transactions made while it was recorded. Times are seconds into the film.

/** The film's id on YouTube; LINKS.demoVideo is the same film as a share link. */
export const DEMO_VIDEO_ID = "6ZTyneTfEqk"
export const DEMO_LENGTH = "2:15"

export const CHAPTERS = [
  { at: 0, label: "Abu, and Tegata" },
  { at: 10, label: "The problem: $68 gone from a $1,250 invoice" },
  { at: 27, label: "What Tegata is" },
  { at: 38, label: "Get paid: invoice, inbox, hold to pay, sealed receipt" },
  { at: 52, label: "Any chain, pay links, counter, checkout" },
  { at: 67, label: "Pay your team: payroll in one hold" },
  { at: 78, label: "Team approvals and autopilot" },
  { at: 90, label: "Send, bank, statement, API, cards" },
  { at: 104, label: "What NEAR does underneath" },
  { at: 117, label: "Docs, X and the free Sandbox" },
] as const

export const MOMENTS = [
  {
    n: "01",
    label: "Get paid",
    title: "Send it. Watch the seal land.",
    body: "An invoice goes out, lands in the customer's inbox with its PDF, and is paid with one hold. The business's seal stamps it the moment NEAR shows the USDC, and both sides get a numbered receipt.",
    at: 38,
    image: "/demo/get-paid.webp",
    alt: "From the film: the customer's pay page turns Paid, $1.00, stamped with Abu Studio's seal, beside the receipt email",
    link: { href: "/invoice/new", text: "Try an invoice, no sign-up" },
  },
  {
    n: "02",
    label: "Any chain",
    title: "They pay in their coin. You get your dollars.",
    body: "USDT on Tron, Bitcoin, Solana: NEAR Intents converts it on the way, so the business receives exactly what it billed. The same account takes pay links, a counter QR and a checkout button on any site.",
    at: 52,
    image: "/demo/any-chain.webp",
    alt: "From the film: the live calculator on tegata.xyz, a customer sends 1,262.88 USDC on Base so the business receives exactly $1,250.00",
    link: { href: "/#quote", text: "Price it live" },
  },
  {
    n: "03",
    label: "Pay your team",
    title: "One hold pays everyone.",
    body: "People choose where their pay lands. On payday one approval pays the whole run in a single all-or-nothing transaction, and each person gets a payslip by email, with its PDF.",
    at: 67,
    image: "/demo/pay-team.webp",
    alt: "From the film: a payroll run marked Paid, one person, in one transaction on NEAR, stamped with the business's seal",
    link: { href: "/#payroll", text: "How payroll works" },
  },
  {
    n: "04",
    label: "Approvals and autopilot",
    title: "A second signature, or nobody at all.",
    body: "Payroll can wait in a team treasury on NEAR until enough approvers say yes. Or the business sets money aside in Tegata's own contract, and it pays each payday with nobody online.",
    at: 78,
    image: "/demo/autopilot.webp",
    alt: "From the film: the Payroll page with autopilot on, $0.20 set aside on NEAR in Tegata's contract for the next payday",
    link: {
      href: "https://docs.tegata.xyz/docs/how-money-moves/autopilot",
      text: "How autopilot works",
    },
  },
  {
    n: "05",
    label: "The rest",
    title: "Send, bank, books, API.",
    body: "Send dollars to anyone, cash out to a bank in naira, cedi or rand, and hand the accountant a month as a CSV and a statement. Developers get a checkout API with signed webhooks. Team cards are next.",
    at: 90,
    image: "/demo/books.webp",
    alt: "From the film: Activity for November with the month as a CSV and the statement PDF",
    link: { href: "https://docs.tegata.xyz", text: "Read the docs" },
  },
] as const

/** Made on camera, on NEAR testnet, by the business in the film (Abu Studio). */
export const FILM_LEDGER = [
  {
    what: "The invoice in the film, INV-0001: $1.00 of USDC from the customer to Abu Studio",
    tx: "68YVbd5sJxRo5pZQsZNp8VEKULdwo6PQazfkVcv7qsfg",
  },
  {
    what: "The payroll run in the film: one hold, paid in one transaction",
    tx: "CZ7hhBF9JjqdfwszRXJF6vs3ck8TcQZRfSifV6U4Vryy",
  },
  {
    what: "The send in the film: $0.10 to a NEAR account, with its sealed receipt",
    tx: "4mAyjsnCnUaV7w84PBmKh1ZCBvXe16Fpt8fpmiMfJaxt",
  },
  {
    what: "Autopilot switched on in the film: $0.20 set aside in Tegata's contract",
    tx: "HwKbfkp7PVUrqTYiuxb6oUfdQM35xDutnekSo2uYVKt6",
  },
] as const
