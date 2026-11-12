<p align="center">
  <a href="https://tegata.84.46.247.92.sslip.io">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/banner-dark.png">
      <img alt="Tegata. Get paid. Pay your team. In exact dollars. Invoices, pay links and payroll for small businesses, settled in USDC on NEAR." src=".github/assets/banner-light.png" width="100%">
    </picture>
  </a>
</p>

<h1 align="center">Tegata · 手形</h1>

<p align="center"><b>Get paid. Pay your team. In exact dollars.</b></p>

<p align="center">
  <b><a href="https://tegata.84.46.247.92.sslip.io">Open the app</a></b> ·
  <b><a href="#demo">Demo</a></b> ·
  <b><a href="https://tegata-docs.84.46.247.92.sslip.io">Docs</a></b> ·
  <b><a href="#proof-on-near">Proof on NEAR</a></b>
</p>

Tegata gives a small business invoices, pay links and payroll that settle in USDC on NEAR. The owner signs in with an
email, and Tegata opens a NEAR account named after the business and pays every network fee with meta
transactions, so nobody buys NEAR or keeps a wallet. A customer pays from a Tegata balance or any NEAR wallet,
and one who holds another coin on another chain sees the live NEAR Intents price for paying with it. The business
receives exactly what it billed. A payment on NEAR counts as paid only when NEAR's own USDC record shows it; then the
invoice is stamped with the business's seal and a numbered receipt links to the transaction. To pay people, the
owner adds them by email or CSV; each person chooses on their own page where their pay lands (their own Tegata
account or a NEAR account), and one approval pays everyone ready in one all-or-nothing transaction, with a payslip
each. Around that sit
customers, part-payments, repeat invoices, PDFs, a business profile, and referrals that reward two
businesses once real customers pay.

Built for **NEAR HACKATHON · Real-World Money** ([how it meets the track](#how-tegata-meets-the-hackathon)).
手形 (_tegata_) is the old Japanese bill of exchange: a written promise to pay, sealed by whoever issues it.

## The problem

A small design studio finishes a job for a client abroad and sends an invoice for $1,250.00. Getting that money
in is slow or expensive:

- **By card**, [Stripe's](https://stripe.com/pricing) published price (checked 12 Nov 2026) is 2.9% + 30¢, plus 1.5% for an
  international card and 1% when the currency is converted: about $68 of the $1,250.
- **By wire**, receiving US dollars into a [Wise Business](https://wise.com/us/pricing/business/receive) account
  costs $6.11, before whatever the client's bank charges to send it.
- **In stablecoins**, the client may already hold digital dollars that move in minutes for under a cent. But to
  take them today, the studio has to:
  1. ask which coin and which blockchain the client holds;
  2. send a wallet address for exactly that chain, and hope the client picks the right network;
  3. watch the wallet and match each incoming transfer to an invoice by its amount;
  4. buy that chain's own token before the money can move again.

If the client holds the wrong coin, someone swaps it by hand, and $1,250.00 arrives as something less, with a
transaction hash instead of a receipt.

## The idea

Tegata makes the stablecoin route as plain as sending an invoice. The studio signs in with its email, and Tegata
opens `studio.tegata.testnet` on NEAR for it: no wallet, no seed phrase, no NEAR to
buy, because Tegata pays every network fee. The studio sends the invoice. The client opens the link, sees the
items and the total, and pays in USDC on NEAR. The studio receives exactly $1,250.00. The invoice turns Paid when
NEAR itself shows the transfer, the studio's seal is stamped on it, and both sides can open a numbered receipt
with the NEAR transaction.

The studio's job becomes: send the invoice, then watch it turn Paid.

### A real one

INV-0001 from Abu Studio, for $0.50 of test USDC with part-payments allowed, paid on the NEAR-wallet rail by `tegata.testnet`
(Tegata's operator, using `pnpm ops pay-link`):

1. $0.20 arrived and the invoice turned **Partly paid**
   ([transaction](https://testnet.nearblocks.io/txns/2q3MP2dbT2sMV5EXX6KpD9d4YUCMprcEKmjZXyWz8cVj)).
2. An attempt to pay $0.40 was refused: "The most left to pay is $0.30".
3. $0.30 arrived, the invoice turned **Paid**, the seal was stamped, and receipt No. 0003 was issued
   ([transaction](https://testnet.nearblocks.io/txns/4DaV5LVezTYavbjzQdfsSUcMYL1Yiz59z5Z4TyFQCquE)).

<p align="center">
  <img src=".github/assets/receipt.png" width="360" alt="Receipt No. 0003 from Abu Studio: $0.30 in USDC on NEAR for invoice INV-0001, paid on the NEAR-wallet rail by tegata.testnet, settled 12 Nov 2026, 17:40 GMT+1, stamped PAID, with its NEAR transaction">
</p>

### Try it on the live Sandbox

The Sandbox is the whole app on NEAR testnet with test USDC, and it's free. You need two email addresses, one for
the business and one for its customer (`you+customer@gmail.com` reaches the same Gmail inbox), and two browser
windows: a normal one and a private one.

| #   | Do this                                                                                                                           | See this                                                                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Open [the app](https://tegata.84.46.247.92.sslip.io/signin), enter your email, then the six-digit code it sends                   | The code cells turn vermilion and Tegata's seal presses                                                                         |
| 2   | Name your business, pick a pay address, press **Open my account**                                                                 | `your-name.tegata.testnet` is created on NEAR and registered for USDC while you watch, then your business's own seal is stamped |
| 3   | Open **Invoices**, press **New invoice**. Add a customer and one item for $1.00, press **Review and send**, then **Send invoice** | The invoice gets its number (INV-0001) and a link. Press **Copy link**                                                          |
| 4   | Open the link in the private window                                                                                               | The invoice as your customer sees it: items, total, a PDF, and **Pay $1.00**                                                    |
| 5   | Press **Pay $1.00**, choose **Tegata balance**, and sign in with the second email; name its business and open its account         | The pay page comes back, signed in as the customer                                                                              |
| 6   | Press **Add $5.00 test dollars**                                                                                                  | 5 test USDC arrive from Tegata's Sandbox stash                                                                                  |
| 7   | Press and hold **Hold to pay $1.00**                                                                                              | Live steps, then your business's seal stamps PAID. **View your receipt** opens receipt No. 0001 with its NEAR transaction       |
| 8   | Back in the first window, open the invoice                                                                                        | **Paid**, the payment on its timeline, and on Home the new balance with the payment under Latest                                |

If **Add test dollars** says "The Sandbox stash is empty right now", get 20 test USDC from [Circle's faucet](https://faucet.circle.com):
choose NEAR Testnet, paste the customer's pay address, then hold to pay.

## Demo

<p align="center">
  <a href="https://tegata.84.46.247.92.sslip.io/invoice/new">
    <img src=".github/assets/demo-cover.png" width="720" alt="Try Tegata live: make an invoice, no sign-up">
  </a>
</p>

The cover opens the live app where a first visit should start: build an invoice without an account, then sign in
to send it. To follow a payment all the way to the PAID seal, use the eight steps in
[Try it](#try-it-on-the-live-sandbox).

## How it works

<p align="center">
  <a href="https://tegata-docs.84.46.247.92.sslip.io/docs/how-money-moves">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/system-dark.png">
      <img alt="Tegata's parts: the business owner and the customer use the web app; the web app stores requests, payments and receipts in Postgres and hands work to the worker; the worker, the only holder of operator keys, relays signed actions to NEAR and pays the fee, and reads the USDC event to mark a payment paid; the web app reads live quotes from NEAR Intents" src=".github/assets/system-light.png" width="100%">
    </picture>
  </a>
</p>

<p align="center"><a href="https://tegata-docs.84.46.247.92.sslip.io/docs/how-money-moves">Open the detailed map</a> · <a href=".github/diagrams/readme-system.mmd">Edit the Mermaid source</a></p>

There are three parts. The **web app** (Next.js) serves the landing page, the app, the public invoice, pay and
receipt pages, and the API. The **worker** runs every slow or risky job: it relays signed actions to NEAR,
settles payments, issues repeat invoices, sends invoice and reminder emails when email is on, and pays referral
rewards. It is the only process
that holds the operator's keys; the web server never does. **Postgres** keeps the books.

<p align="center">
  <a href="https://tegata-docs.84.46.247.92.sslip.io/docs/how-money-moves">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset=".github/assets/payment-dark.png">
      <img alt="One payment: the pay page starts an attempt with the memo tegata:pay:id; the customer pays from a Tegata balance (Tegata relays it and pays the fee) or a NEAR wallet; the worker reads the final transaction from NEAR, matches the USDC event's receiver, amount and memo, marks it paid and numbers the receipt" src=".github/assets/payment-light.png" width="100%">
    </picture>
  </a>
</p>

<p align="center"><a href="https://tegata-docs.84.46.247.92.sslip.io/docs/how-money-moves">Open the detailed map</a> · <a href=".github/diagrams/readme-payment.mmd">Edit the Mermaid source</a></p>

Every payment attempt carries its own memo, `tegata:pay:<id>`. Nothing the payer's browser says is believed:
the worker waits until the transaction is final on NEAR, reads the USDC contract's own transfer event, and marks
the attempt paid only if the receiver is the business, the amount covers what is due, and the memo is this
attempt's. A signed action is saved before it is sent, so a worker that restarts mid-send re-sends the same bytes
and never pays twice.

### Built on NEAR

| Piece                       | What it does in Tegata                                                                                                                                                       | Where in the code                                                                      |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Named accounts              | Every business gets `name.tegata.testnet` (`.tegata.near` on mainnet, once Live is built), created by Tegata's operator with the owner's own key as its only full-access key | `packages/core/src/near/accounts.ts`, `operator.ts`                                    |
| Meta transactions (NEP-366) | The owner signs a delegate action with the key from their email login; the worker relays it and pays the fee, so user accounts hold 0 NEAR                                   | `packages/core/src/near/delegate.ts`, `packages/services/src/relays.ts`, `apps/worker` |
| USDC on NEAR (NEP-141)      | Every balance, payment and reward. "Paid" is decided by the USDC transfer event, read from the final transaction                                                             | `packages/core/src/near/usdc.ts`, `transfers.ts`, `packages/services/src/payments.ts`  |
| NEAR Intents (1Click API)   | Live quotes for the landing calculator and the pay page: what a payer on Base, Solana, Tron, Bitcoin and more sends so the business receives the exact amount                | `apps/web/lib/server/oneclick.ts`, `GET /api/quote`                                    |
| NEAR Connect                | Customers pay from their own NEAR wallet: in the Sandbox, the wallets NEAR Connect lists for testnet, such as Meteor and Intear                                              | `apps/web/lib/client/near-wallet.ts`                                                   |
| Privy                       | Email sign-in that gives each owner a NEAR key without a wallet app                                                                                                          | `apps/web/app/providers.tsx`                                                           |

USDC contracts: `3e2210e1184b45b64c8a434c0a7e7b23cc04ea7eb7a6c3c32520d03d4afcb8af` on testnet,
`17208628f84f5d6ad33f0da3bbbeb27ffcb398eac501a31bd6ad2011e36133a1` on mainnet.

## How Tegata meets the hackathon

Track 08, Real-World Money: "Bring the boring money onchain". The build asked for: "Build payroll, invoicing,
remittances, merchant payments and stablecoin rails for real businesses. Something a normal company could use
tomorrow." What to lean on: "Stablecoins, NEAR Intents, meta transactions".

| Asked for                                       | How Tegata meets it                                                                                                        | Where to check                                                                                                                       |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| "invoicing"                                     | Numbered invoices with customers, items, discount, tax and due dates; part-payments, repeat invoices, a PDF and a timeline | `/app/invoices`; `packages/services/src/invoices.ts`; [INV-0001](#a-real-one)                                                        |
| "merchant payments"                             | Pay links for a fixed or any amount, with a QR code, paid from a Tegata balance or a NEAR wallet                           | `/app/links`; [transaction](https://testnet.nearblocks.io/txns/4rs3uTXRaCnNCsMepj4tDiTsTZuootKSsW2QzqMkcaQ5)                         |
| "payroll"                                       | People added by email or CSV choose where pay lands on their own page; one approval pays everyone ready in one all-or-nothing transaction, with a payslip each | `/app/people`, `/app/payroll`; `packages/services/src/payroll.ts`; [transaction](https://testnet.nearblocks.io/txns/7hEg9DgZdEaq7e4AHtY9FZ4ReB3sveq5XwewiEanCKFr) |
| "remittances"                                   | Send dollars to any NEAR account that can hold USDC, in one hold; Tegata pays the fee                                      | `/app/send`; [transaction](https://testnet.nearblocks.io/txns/4a5U9osgJrXKN5EDT3mvrWGT6NrFXoQXwH4bYZjqH6TX)                          |
| "stablecoin rails", "Stablecoins"               | USDC on NEAR holds every balance and settles every payment, receipt and reward                                             | `packages/config/src/index.ts`; `packages/core/src/near/usdc.ts`                                                                     |
| "NEAR Intents"                                  | Live 1Click quotes on the landing calculator and the pay page, for the business to receive the exact amount                | `apps/web/lib/server/oneclick.ts`                                                                                                    |
| "meta transactions"                             | Every user action is a NEP-366 delegate action relayed by Tegata; user accounts never hold NEAR                            | `packages/core/src/near/delegate.ts`; [transaction](https://testnet.nearblocks.io/txns/8oDoAfrPgHFRKW7jKKGzHmURxmErFTHYLVhByrzp9Bxk) |
| "Something a normal company could use tomorrow" | Email sign-in, dollars only, no wallet; invoices, PDFs and receipts in the shape a bookkeeper expects                      | [Try it](#try-it-on-the-live-sandbox); [If you keep the books](#if-you-keep-the-books)                                               |

The track's example prompt is a starting point, not a requirement. Against its list:

| Example prompt                                                                                                                          | Tegata                                                                                                                                                                                                                                | Where to check                                                  |
| --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| "Invoice page with amount, due date, line items and a pay button. Payment goes through the 1Click API."                                 | The public invoice has all four and a sticky Pay button. 1Click prices the other-chain route today; for the deposit itself see [Honest limits](#honest-limits)                                                                        | `/i/<token>`; `apps/web/components/invoices/public-invoice.tsx` |
| "Gasless for the freelancer: route their transactions through a meta transaction relayer that only pays for calls to our own contract." | The relayer sponsors only action lists the server drafted itself (USDC transfers the app asked for). The browser signs; the server re-encodes and requires the exact bytes                                                            | `packages/services/src/relays.ts`                               |
| "Status updates the freelancer can trust: paid, pending or refunded, with links to the transactions."                                   | A payment on NEAR counts only on its own USDC event (money received another way is marked paid by hand, and its receipt says so); every receipt links its transaction; invoices show Sent, Viewed, Partly paid, Overdue, Paid or Void | `packages/core/src/near/transfers.ts`                           |
| "CSV export an accountant could open without asking a single question."                                                                 | See [Honest limits](#honest-limits)                                                                                                                                                                                                   | —                                                               |
| "Write the README first as if a bookkeeper will read it."                                                                               | This README was written before the code and grew with it                                                                                                                                                                              | [If you keep the books](#if-you-keep-the-books)                 |

Judging, in the organiser's words: "Claude Code & Codex screen every project first: they check that it runs and
does what the README says. … Previous NEAR hackathons evaluated technical implementation, design, impact,
originality and sustainability."

| Criterion                          | Tegata                                                                                                                                                                                                                                   | Where to check                                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Runs and does what the README says | Every row of Try it runs on the live Sandbox; every claim below has a transaction or a script                                                                                                                                            | [Try it](#try-it-on-the-live-sandbox); [Proof on NEAR](#proof-on-near)                                      |
| Technical implementation           | A relayer that lands each action exactly once, even after a crash mid-send; payments decided by NEAR's own USDC event; invoice and receipt numbers that can't collide; background jobs for settling, repeat invoices, emails and rewards | `packages/services/src/proofs/recover.ts`; `packages/core/src/near/operator.ts`; `apps/worker/src/index.ts` |
| Design                             | One system: each business's own seal stamps its invoices and receipts; a lit vermilion stage; real chain and coin logos; motion and sound; light and dark; payer pages designed for phones first                                         | [`/dev`](https://tegata.84.46.247.92.sslip.io/dev) shows every part in every state                          |
| Impact                             | A $1,250 card payment from abroad costs the business about $68; with Tegata it receives the full $1,250 and never touches crypto tooling                                                                                                 | [The problem](#the-problem); [Try it](#try-it-on-the-live-sandbox)                                          |
| Originality                        | A generated seal per business as the PAID stamp; readable NEAR pay addresses; referrals that pay only when money arrives from real customers, never from either business or anyone they funded                                           | `apps/web/components/brand/seal.tsx`; `packages/services/src/referrals.ts`                                  |
| Sustainability                     | About 0.0003 NEAR in fees per relayed action, measured and paid by Tegata; one small server and Postgres; MIT licensed                                                                                                                   | [Proof on NEAR](#proof-on-near)                                                                             |

## Proof on NEAR

Recorded on NEAR testnet. Every one opens on the explorer.

| What happened                                                                                                                                                                      | Transaction                                                                                                                                                                            |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| An account holding 0 NEAR moved a token (0.001 wNEAR on `wrap.testnet`); Tegata's operator paid 0.00029 NEAR in fees                                                               | [8oDoAf…](https://testnet.nearblocks.io/txns/8oDoAfrPgHFRKW7jKKGzHmURxmErFTHYLVhByrzp9Bxk)                                                                                             |
| `abu-studio.tegata.testnet` sent 1.00 test USDC from the app; it still holds 0 NEAR                                                                                                | [4a5U9o…](https://testnet.nearblocks.io/txns/4a5U9osgJrXKN5EDT3mvrWGT6NrFXoQXwH4bYZjqH6TX)                                                                                             |
| A pay link for 0.25 was paid on the NEAR-wallet rail by `tegata.testnet` (`pnpm ops pay-link`) and marked paid from the USDC event                                                 | [4rs3uT…](https://testnet.nearblocks.io/txns/4rs3uTXRaCnNCsMepj4tDiTsTZuootKSsW2QzqMkcaQ5)                                                                                             |
| INV-0001 was paid 0.20, then 0.30, the same way; a 0.40 attempt in between was refused                                                                                             | [2q3MP2…](https://testnet.nearblocks.io/txns/2q3MP2dbT2sMV5EXX6KpD9d4YUCMprcEKmjZXyWz8cVj), [4DaV5L…](https://testnet.nearblocks.io/txns/4DaV5LVezTYavbjzQdfsSUcMYL1Yiz59z5Z4TyFQCquE) |
| Referral: a payment from an account the inviting business had sent money to; it didn't count                                                                                       | [8DY4Wa…](https://testnet.nearblocks.io/txns/8DY4WakUkhYHLPLsGd9rM2Y6dVgAL4YDFVa32XZSQauZ)                                                                                             |
| Referral: a fresh customer account (made by the proof script and funded by Tegata's operator, never by either business) paid the invited business 5.00, which qualified the invite | [5rdLsx…](https://testnet.nearblocks.io/txns/5rdLsxc1kMucKP2phfen3M5wwTgetLHYcg3u1fjPZqWs)                                                                                             |
| Referral: 1.00 reward to the business that invited, after the 10-minute hold                                                                                                       | [GPweE9…](https://testnet.nearblocks.io/txns/GPweE94qUfz4EecjcKyyXpTRrkCkYpaaY4YZDtwhjB3U)                                                                                             |
| Referral: 1.00 reward to the business that joined                                                                                                                                  | [2REcTS…](https://testnet.nearblocks.io/txns/2REcTS4fZ6rqnWUEQBxZoe8VUgenN3aaUKcQ5ghqYtT9)                                                                                             |
| Payroll: Tegata's operator registered a person's own NEAR account for USDC so it could be paid                                                                                     | [G9ZMLt…](https://testnet.nearblocks.io/txns/G9ZMLtY9grbqzwva6hhUjtFxqUErcAeEw4p4qjFPpad7)                                                                                             |
| Payroll: one approval paid 0.50 to a person's own Tegata account and 0.30 to another's NEAR account, in one all-or-nothing transaction; a third, who hadn't chosen, was skipped | [7hEg9D…](https://testnet.nearblocks.io/txns/7hEg9DgZdEaq7e4AHtY9FZ4ReB3sveq5XwewiEanCKFr)                                                                                             |

Run the proofs yourself (after [Run it locally](#run-it-locally)):

| Proof                                                                                                     | Command                                                                                                           |
| --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| A 0-NEAR account moves a token (wNEAR); the operator pays                                                 | `pnpm ops proof-relay`                                                                                            |
| Many gas-free actions at once never collide or double-send                                                | `pnpm ops proof-parallel`                                                                                         |
| An action interrupted before or after sending lands exactly once                                          | `pnpm --filter @tegata/services exec tsx src/proofs/recover.ts`                                                   |
| An invoice sent through the app's own services; pay it in parts with `pnpm ops pay-link <link> <dollars>` | `pnpm --filter @tegata/services exec tsx src/proofs/invoice.ts`                                                   |
| A referral: self-referral refused, a funded payer ignored, both rewards paid                              | `pnpm --filter @tegata/services exec tsx src/proofs/referral.ts setup`, then `pay <link> <dollars>`, then `sweep` |
| Payroll: three people (one from a CSV), a Tegata account and a NEAR account chosen, one run, a 24-hour change | `pnpm --filter @tegata/services exec tsx src/proofs/payroll.ts`                                                   |

## The rest of the product

| Do this                                                       | See this                                                                                                                                                                                                        |
| ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| On `/`, change the amount or the coin in the calculator       | A live NEAR Intents quote: what a customer on Tron, Base, Bitcoin… sends so you receive exactly that many dollars                                                                                               |
| On `/`, press **Try an invoice, no sign-up**                  | Build an invoice before you have an account; it stays on your device and opens in your account when you sign in to send it                                                                                      |
| Open **Pay links**, make one for a fixed amount or any amount | The link card and its QR with Copy, Share and Open; payments appear on it the moment NEAR settles them                                                                                                          |
| Pay a link or an invoice from a NEAR wallet                   | NEAR Connect opens your wallet for one USDC transfer with the payment's memo; the page follows it to Paid                                                                                                       |
| On a pay page, choose **Another chain**                       | Real coin and chain logos with a live NEAR Intents price for the exact amount, or the route's reason (such as a minimum)                                                                                        |
| In an invoice, allow part-payments or set Repeat              | Customers can pay part of it; a weekly or monthly invoice issues itself shortly after 09:00 in your time zone. Reminder emails (3 days before, on, and 3 and 7 days after the due date) go out once email is on |
| Mark an invoice paid by hand, duplicate one, void one         | A receipt that says it isn't on NEAR; a fresh draft; a cancelled invoice whose link stops taking payments                                                                                                       |
| Open **Customers**                                            | Each customer with their email, how many invoices you sent them and what they owe; their sheet shows billed, paid and owed, and New invoice for them                                                            |
| Open **Refer** and share your link                            | Another business opens `/join/<you>`, joins, and once real customers have paid it $5 (Sandbox) you each get $1 in test USDC                                                                                     |
| Open **People**, add someone or import a CSV                  | Each person gets a page (`/p/<token>`) where they sign in with the invited email and choose their own Tegata account or a NEAR account; a CSV row with a mistake says which line and why |
| Open **Payroll**, set a payday, press **Run payroll**         | Review every row (leave someone out, see who's skipped and why), hold to pay, and everyone ready is paid in one transaction on NEAR, each with a payslip at `/r/slip/<id>` |
| Open **Send**                                                 | Send dollars to any NEAR account that can hold USDC: hold to send, live steps, a sealed receipt, and no fee for you                                                                                             |
| Open **Business**                                             | Your logo, address, tax ID and time zone, with a live preview of the header on every invoice and receipt                                                                                                        |
| Press ⌘K                                                      | Every action and place in the app, from the keyboard                                                                                                                                                            |
| Open [`/dev`](https://tegata.84.46.247.92.sslip.io/dev)       | Every part of the design in every state: the seal, colour, type, components, loading and error states, motion and sound                                                                                         |

## If you keep the books

- **Dollars, not coins.** Every amount is in USDC, a digital dollar issued by Circle. One USDC is one US dollar.
- **Exact amounts.** An invoice for 1,250.00 is settled by exactly 1,250.00 reaching the business. Tegata takes
  no cut.
- **Numbers in order.** Invoices are numbered INV-0001, INV-0002… when they are sent; a voided invoice keeps its
  number. Receipts for customer payments are numbered No. 0001, No. 0002… per business.
- **A receipt for every movement:** customer payments, sends, referral rewards and payslips. Each says who paid whom, for
  what, when, how, and who paid the fee, then links to the transaction on NEAR. Every row on Home opens its
  receipt first. Money received another way can be marked paid by hand; its receipt says so.

## Run it locally

Needs Node 22.18 or newer, pnpm 11, Docker, and a free [Privy](https://dashboard.privy.io) app with email login.

```bash
pnpm install
cp .env.example .env          # fill in POSTGRES_PASSWORD, DATABASE_URL and the four PRIVY_ values
pnpm services:up              # Postgres on 127.0.0.1:54330
pnpm db:migrate
node scripts/testnet-account.mjs my-studio.testnet   # a free testnet account for the operator
```

Set `NETWORKS.testnet.operator` in `packages/config/src/index.ts` to that account (it becomes the parent of every
user account), then:

```bash
pnpm ops add-keys testnet 3   # writes OPERATOR_KEYS_TESTNET to .env
pnpm dev                      # the web app on :3100, the worker, and the docs on :3300
```

For **Add test dollars**, send the operator some test USDC from [Circle's faucet](https://faucet.circle.com).
`pnpm ci` runs Biome, the type checks, the tests and the build.

## Repository layout

```
apps/web            Next.js: landing, sign-in, the app, public invoice, pay and receipt pages, API, and /dev
apps/worker         background jobs; the only process that holds operator keys
apps/docs           the docs site
packages/config     constants: networks, gas, limits, referral rules
packages/core       money and invoice maths, schedules; NEAR: accounts, USDC, delegate actions, the operator
packages/db         Postgres schema and migrations
packages/documents  the invoice PDF and the emails
packages/env        the only reader of server environment variables
packages/jobs       queue definitions
packages/services   database-aware logic shared by the web app and the worker
```

## Credits and reused work

The hackathon rules allow earlier work, libraries and AI-written code if they are listed here (Q-005).

- **From the author's earlier projects** (Kawase, Senryo, Mamori): the pnpm and turbo workspace setup, the testnet
  account script, the Postgres compose file, the NEAR wallet payment helper; the design grammar and several web
  components first sourced from 21st.dev (hold to confirm, segmented control, task steps, text shimmer, the
  sound-feedback module, the rail and dock layout; each file says where it came from); the interface and money
  sound cues, from SND's kits (snd.dev, free for use inside a service), processed in Kawase.
- **Logos:** chain and coin marks from the NEAR Intents swap widget (MIT) and the brands' own kits; see
  `apps/web/public/marks/PROVENANCE.md`.
- **Fonts:** Archivo and DM Mono (SIL Open Font Licence); the seal's glyphs are outlines from Shippori Mincho B1
  (SIL Open Font Licence).
- **Libraries:** Next.js, React, Tailwind CSS, Radix, Drizzle ORM, Postgres, pg-boss, TanStack Query, zod, Privy,
  near-api-js, NEAR Connect, react-pdf, react-email, Resend, motion, NumberFlow, vaul, cmdk, qrcode.react, Biome.
- **AI:** parts of the code were written with AI coding assistants.

Everything else in this repository was written during the hackathon.

## Honest limits

- **Live isn't built yet.** Everything runs on NEAR testnet with test USDC. Live needs Tegata's `tegata.near`
  operator and the mainnet side of the app.
- **Paying from another chain stops at the quote.** NEAR Intents has no testnet, so the deposit address that
  turns a payer's coin into USDC on NEAR is part of Live and not built yet; today customers pay in USDC on NEAR.
- **Emails are switched off on the live site** until a sending domain is set up, so invoice and reminder emails
  don't go out. Sending an invoice still gives you its link to share.
- **Payroll pays Tegata and NEAR accounts.** Another chain is Live-only, and a bank account is shown locked:
  cash-out to a bank needs a licensed payout partner. Payroll and "you've been paid" emails wait for email too;
  until then the business shares each person's link.
- **Not in this build yet:** CSV export and the monthly statement, refunds, signing in with a NEAR wallet, and the
  scheduled-payroll contract.
- **The Sandbox stash is shared.** Add test dollars draws from Tegata's own test USDC and can run dry; Circle's
  faucet is the fallback.
- **Referrals don't yet flag two accounts opened from one device or network.**
- **No outside businesses have used it yet.**

## Licence

[MIT](LICENSE).
