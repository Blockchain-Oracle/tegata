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

In the app (Sandbox): sign in with an emailed code, name the business, get `name.tegata.testnet`
created and registered for USDC, and send test dollars with no NEAR in the account. A recorded send of
1.00 test USDC from `abu-studio.tegata.testnet`:
[transaction](https://testnet.nearblocks.io/txns/4a5U9osgJrXKN5EDT3mvrWGT6NrFXoQXwH4bYZjqH6TX).

A recorded run of the first proof: account `proof-f4b082b1.tegata.testnet` held 0 NEAR before and after;
the operator `tegata.testnet` paid 0.00029 NEAR in fees.
[Transaction](https://testnet.nearblocks.io/txns/8oDoAfrPgHFRKW7jKKGzHmURxmErFTHYLVhByrzp9Bxk).

## What is being built

Invoices, pay links and a developer checkout, all paid through one page; people and payroll; scheduled
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
projects: the pnpm and turbo workspace setup, the testnet account script and the Postgres compose file.
Everything else in this repository was written during the hackathon.

## Licence

MIT.
