# NEAR HACKATHON submission

The form at nearhackathon.com/#apply, field by field, in its order. One submission per repository: a second one is
rejected, so check every value before sending.

| Field               | Value                                                    | Limit                           |
| ------------------- | -------------------------------------------------------- | ------------------------------- |
| Project name        | Tegata                                                   | 2–80 characters                 |
| Team lead           | your name                                                | 2–80 characters                 |
| Email address       | your email                                               | at most 2 submissions per email |
| Team size           | 1 — Solo builder                                         | one of the listed sizes         |
| Tracks              | Real-World Money (`realworld`), Open Innovation (`open`) | one or more                     |
| NEAR wallet address | where the prize goes, for example `tegata.near`          | lowercase NEAR account          |
| Repository link     | https://github.com/Blockchain-Oracle/tegata              | public before submitting        |
| Demo post link      | the X post below, once it is live                        | public post                     |
| What did you build? | the text below (1737 characters)                         | 20–2000 characters              |
| Website             | leave empty (a non-empty value rejects the submission)   | —                               |
| Consent             | tick it                                                  | required                        |

Tracks: Real-World Money is the build this project answers. Open Innovation says "You can enter this track
alongside any other" and leans on chain abstraction, which is how Tegata takes and pays any coin through NEAR Intents.

## What did you build?

A small business that bills a client abroad loses about $68 of a $1,250 invoice to a card, or waits on a wire; taking stablecoins instead means asking which chain, sending the right address and matching transfers by hand.

Tegata is the money account for a small business, settled in USDC on NEAR. The owner signs in with an email; Tegata opens name.tegata.near and pays every network fee with NEP-366 meta transactions, so nobody buys NEAR or keeps a wallet.

Getting paid: numbered invoices (part-payments, reminders, repeat, PDF), pay links, a counter QR and a checkout API with signed webhooks. The customer pays from a Tegata balance, any NEAR wallet (NEAR Connect) or a coin on another chain (USDT on Tron, BTC, SOL, USDC on Base… through NEAR Intents, EXACT_OUTPUT, so the business receives exactly what it billed). A payment counts only when the USDC contract's own event on NEAR shows the right receiver, amount and per-payment memo; then the business's seal stamps a numbered receipt linked to the transaction.

Paying out: one approval pays a whole payroll as up to 50 USDC transfers in one all-or-nothing delegate action, to each person's Tegata account, NEAR account or address on another chain. Our own Rust contract (pay.tegata.testnet, 12 sandbox tests) pays payroll on schedule with nobody online. Also Send, refunds, bank withdrawals in naira, cedi and rand (Sandbox, through Noah) and virtual Visa cards (Bitnob, opening once its sandbox keys are set). Books: activity, CSV, a monthly statement and the books checked against NEAR.

Try it at https://tegata.xyz: the README's eight steps run on the free Sandbox (NEAR testnet, test dollars), and Live (mainnet, tegata.near) is switched on. Docs: https://docs.tegata.xyz

## Demo post on X

Post from @TegataNEAR with the demo video attached. The organiser asks for one complete moment (a real action to a
visible result), the words NEAR HACKATHON, @NEARProtocol and #NEARHackathon, and links to the demo and the repository.
279 of 280 characters as X counts them (each link counts as 23).

```text
Built at NEAR HACKATHON: Tegata 手形

Send an invoice. Your client pays from any chain. You get exactly what you billed, in USDC on NEAR, with a sealed receipt. Email sign-in, no wallet.

Try it: https://tegata.xyz
Code: https://github.com/Blockchain-Oracle/tegata

@NEARProtocol #NEARHackathon
```

## Before submitting

- [ ] The repository is public, with the LICENSE (MIT) at its root.
- [ ] The README's eight "Try it" steps run on https://tegata.xyz.
- [ ] The demo video is recorded and attached to the X post, and the post is live.
- [ ] One real Live payment is made, so the README can add its mainnet transaction.
- [ ] No keys or secrets in the history (gitleaks finds 14 matches: sample tokens, a storage key name, a public token
  address and a character set; none is a secret).
- [ ] Every track the project fits is selected.

## The request, for the API

`POST https://nearhackathon.com/api/applications` with `Content-Type: application/json`, exactly these fields:

```json
{
  "requestId": "<one new UUID, reused on retries>",
  "projectName": "Tegata",
  "leadName": "<your name>",
  "email": "<your email>",
  "size": "1",
  "tracks": ["realworld", "open"],
  "nearAddress": "<prize wallet, e.g. tegata.near>",
  "projectUrl": "https://github.com/Blockchain-Oracle/tegata",
  "demoUrl": "<link to the X demo post>",
  "idea": "A small business that bills a client abroad loses about $68 of a $1,250 invoice to a card, or waits on a wire; taking stablecoins instead means asking which chain, sending the right address and matching transfers by hand.\n\nTegata is the money account for a small business, settled in USDC on NEAR. The owner signs in with an email; Tegata opens name.tegata.near and pays every network fee with NEP-366 meta transactions, so nobody buys NEAR or keeps a wallet.\n\nGetting paid: numbered invoices (part-payments, reminders, repeat, PDF), pay links, a counter QR and a checkout API with signed webhooks. The customer pays from a Tegata balance, any NEAR wallet (NEAR Connect) or a coin on another chain (USDT on Tron, BTC, SOL, USDC on Base… through NEAR Intents, EXACT_OUTPUT, so the business receives exactly what it billed). A payment counts only when the USDC contract's own event on NEAR shows the right receiver, amount and per-payment memo; then the business's seal stamps a numbered receipt linked to the transaction.\n\nPaying out: one approval pays a whole payroll as up to 50 USDC transfers in one all-or-nothing delegate action, to each person's Tegata account, NEAR account or address on another chain. Our own Rust contract (pay.tegata.testnet, 12 sandbox tests) pays payroll on schedule with nobody online. Also Send, refunds, bank withdrawals in naira, cedi and rand (Sandbox, through Noah) and virtual Visa cards (Bitnob, opening once its sandbox keys are set). Books: activity, CSV, a monthly statement and the books checked against NEAR.\n\nTry it at https://tegata.xyz: the README's eight steps run on the free Sandbox (NEAR testnet, test dollars), and Live (mainnet, tegata.near) is switched on. Docs: https://docs.tegata.xyz",
  "consent": true
}
```
