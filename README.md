# Tegata

Tegata (手形, the old Japanese bill of exchange) lets a small business get paid and pay its people in
dollars, on NEAR. A customer pays from any chain with whatever coin they hold. The business receives an
exact amount of USDC on NEAR. Nobody using it buys NEAR for fees.

Built for NEAR HACKATHON, track 08 Real-World Money.

> **Status: under construction.** This README is written first and grows with the product. Everything in
> "What works today" can be run and checked. Everything in "What is being built" is not finished.

## If you keep the books

- **Dollars, not coins.** Every amount is in USDC, a digital dollar issued by Circle. One USDC is one US dollar.
- **Exact amounts.** An invoice for 500.00 arrives as exactly 500.00. A payroll run for 1,200.00 leaves as
  exactly 1,200.00.
- **Three statuses.** A payment is pending, paid or refunded. Each one links to its public record on NEAR.
- **One export.** A CSV with one row per movement: date, type, who, what for, amount, fee, net, and the link.

## What works today

The foundation, on NEAR testnet:

| What                                                                               | How to see it                                                   |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| A user account that holds no NEAR can still move tokens; our operator pays the fee | `pnpm ops proof-relay` prints the transaction link              |
| Many gas-free actions at once never collide or double-send                         | `pnpm ops proof-parallel`                                       |
| An action interrupted mid-send lands exactly once after a restart                  | `pnpm --filter @tegata/services exec tsx src/proofs/recover.ts` |

In the app (Sandbox), live at **https://tegata.84.46.247.92.sslip.io**:

| Do this | See this |
| --- | --- |
| Open `/` and change the amount or the coin in the calculator | A live NEAR Intents quote: what a customer on Tron, Base, Bitcoin… sends so you receive exactly that many dollars |
| Sign in with your email | A six-digit code inside the page; the cells turn vermilion and Tegata's seal presses when it is accepted |
| Name your business and pick your pay address | `name.tegata.testnet` is created on NEAR and registered for USDC while you watch, then your business's own seal is stamped |
| On Home, press Get paid | Your NEAR pay address as a QR, ready to share |
| Send test dollars to another NEAR account | Hold to send, live steps, and a sealed receipt linked to NEAR. Your account never holds NEAR; Tegata pays the fee |
| Open Pay links and make one (a fixed amount or "any amount") | The link card and its QR, with Copy, Share and Open |
| Open the link as a payer | Pay from a Tegata balance (email sign-in, no fees) or a NEAR testnet wallet. Paying from another chain shows a live NEAR Intents price and says it runs in Live, because NEAR Intents has no testnet |
| Pay it | Live steps, then the business's seal stamps PAID. The link's page shows the payment the moment NEAR settles it |
| Open the receipt | A numbered receipt with who paid whom, how, when, and the NEAR transaction. Share it or save it as a PDF |
| On `/`, press Try an invoice, no sign-up | Build an invoice before having an account; it stays on your device and opens in your account when you sign in to send it |
| Open Invoices, press New invoice | Pick or add a customer, add items, a discount and tax; the invoice, its pay page and its email preview update as you type |
| Send it | It gets the next number (INV-0001…) and a link. Open the link as the customer: the invoice, a Pay button for what is left, and a PDF |
| Allow part-payments and pay part of it | The invoice turns Partly paid, shows what is left, and turns Paid with the business's seal when the rest arrives. Every step is on its timeline |
| Mark one paid by hand, duplicate one, void one | A receipt that says it isn't on NEAR; a fresh draft; a cancelled invoice whose link stops taking payments |
| On Home, press Add test dollars | 5 test USDC from Tegata's Sandbox stash, once a day, so you can pay a link without a wallet |
| Open Business | Your logo, address, tax ID and time zone, with a live preview of the header every receipt carries; your seal follows your name |
| Open `/dev` | Every part of the design in every state: the seal, colour, type, components, loading and error states, motion and sound |

A payment is marked paid only when Tegata reads, from NEAR itself, a USDC transfer to the business for the full
amount carrying that payment's own memo (`tegata:pay:<id>`). Nothing the payer's browser says is believed.

A recorded send of 1.00 test USDC from `abu-studio.tegata.testnet`:
[transaction](https://testnet.nearblocks.io/txns/4a5U9osgJrXKN5EDT3mvrWGT6NrFXoQXwH4bYZjqH6TX).

A recorded part-paid invoice: INV-0001 for 0.50 test USDC, paid 0.20
([transaction](https://testnet.nearblocks.io/txns/2q3MP2dbT2sMV5EXX6KpD9d4YUCMprcEKmjZXyWz8cVj)) then 0.30
([transaction](https://testnet.nearblocks.io/txns/4DaV5LVezTYavbjzQdfsSUcMYL1Yiz59z5Z4TyFQCquE)); an attempt to pay 0.40
was refused because only 0.30 was left.

A recorded pay-link payment of 0.25 test USDC to `abu-studio.tegata.testnet`, made with
`pnpm ops pay-link <link>` (the operator account paying the way a NEAR wallet does):
[transaction](https://testnet.nearblocks.io/txns/4rs3uTXRaCnNCsMepj4tDiTsTZuootKSsW2QzqMkcaQ5).

A recorded run of the first proof: account `proof-f4b082b1.tegata.testnet` held 0 NEAR before and after;
the operator `tegata.testnet` paid 0.00029 NEAR in fees.
[Transaction](https://testnet.nearblocks.io/txns/8oDoAfrPgHFRKW7jKKGzHmURxmErFTHYLVhByrzp9Bxk).

## What is being built

Invoice email (it waits for a Resend key) and a developer checkout; people and payroll; scheduled
payroll held in a contract; receipts, activity and exports. This list moves up into "What works today" as
each part ships.

## How NEAR is used

| NEAR piece                  | Job                                                                                     |
| --------------------------- | --------------------------------------------------------------------------------------- |
| Meta transactions (NEP-366) | The user signs an action; the operator account sends it and pays the fee                |
| Native USDC (NEP-141)       | Every balance and settlement                                                            |
| NEAR Intents (1Click API)   | Converts a payer's coin on another chain into USDC on NEAR, and the reverse for payouts |
| Named accounts              | Each user gets `name.tegata.near`                                                       |
| A Rust contract             | Holds funds for scheduled payroll and pays each row with a confirmation                 |

## Run it

Needs Node 22.18 or newer, pnpm 11 and Docker.

```bash
pnpm install
cp .env.example .env        # then fill in POSTGRES_PASSWORD and DATABASE_URL
pnpm services:up            # local Postgres
pnpm db:migrate
node scripts/testnet-account.mjs <your-name>.testnet   # a free testnet operator account
pnpm ops add-keys testnet 3 # writes OPERATOR_KEYS_TESTNET to .env
pnpm ops proof-relay
```

The operator account name is set in `packages/config/src/index.ts` (`NETWORKS.testnet.operator`).

## Layout

```
apps/web           Next.js: landing, sign-in, the app, public pages, API, and /dev (the design review)
apps/worker        background jobs; the only process that holds operator keys
packages/config    constants: networks, gas, limits
packages/core      money maths; NEAR: accounts, USDC, gas-free actions, the operator
packages/db        Postgres schema and migrations
packages/env       the only reader of environment variables
packages/jobs      queue definitions
packages/services  database-aware logic shared by the web app and the worker
```

## Reused work

Allowed by the hackathon rules (Q-005) and listed here as they require. From the author's earlier
projects (Kawase, Senryo, Mamori):

- the pnpm and turbo workspace setup, the testnet account script and the Postgres compose file;
- the design grammar and several web components first sourced from 21st.dev: hold to confirm, segmented
  control, task steps, text shimmer, the sound-feedback module and the rail and dock layout (each file says
  where it came from);
- the interface and money sound cues: SND's sound kits (snd.dev, free for use inside a service), processed
  in Kawase.

Chain and coin logos come from the NEAR Intents swap widget (MIT) and the brands' own kits; see
`apps/web/public/marks/PROVENANCE.md`. Everything else in this repository was written during the hackathon.

## Licence

MIT.
