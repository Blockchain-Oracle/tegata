# Tegata on X

Prepared 13 November 2026. The exact account is still to be chosen. This is profile copy and a demo-post handoff, not a record of changes made on X.

## Profile

- Existing account: **not identified yet**. Verify its current `@handle` before changing anything.
- New `@handle`: try **`@Tegata`**, then **`@TegataNEAR`** if the first is unavailable. Abu asked for a handle containing “Tegata.” Availability is unverified and must be checked in X settings. The name must be unique, 5–15 characters, and use letters, numbers or underscores.
- Display name: **Tegata**
- Avatar: [`assets/profile/x-avatar.png`](assets/profile/x-avatar.png) — rendered from the existing Tegata 手形 seal in `apps/web/app/icon.svg`.
- Header: [`assets/profile/x-banner.png`](assets/profile/x-banner.png) — 3:1, with the lower-left left clear for X's avatar overlay.
- Bio: `Invoices, pay links and payroll for small businesses. USDC on NEAR. Testnet Sandbox live; mainnet is not yet built.`
- Website: `https://tegata.84.46.247.92.sslip.io` (the app returned HTTP 200 on 13 November 2026).
- Pinned post: the NEAR HACKATHON demo post after it has been published.

The banner's invoice is a sample, as in Tegata's README artwork. The account identity should be changed only after the exact X account is confirmed.

Handle rename belongs in the rebrand, not only the display name. Changing it also changes the profile URL; X says the old handle becomes immediately available to others. After renaming, update campaign `account`, any website or hackathon links, and the pinned post URL. [X documents the handle change in its account settings](https://help.x.com/en/managing-your-account/change-x-handle). The API publisher should not guess a handle or use a browser cookie to perform the rename.

## Required NEAR HACKATHON demo post

The [live organiser guide](https://nearhackathon.com/HACKATHON.md) says the human publishes the public demo post before the deadline, with `@NEARProtocol`, `#NEARHackathon`, and video or screenshots. The deadline shown on 13 November was **14 November 23:59 UTC / 15 November 00:59 Lagos**. Recheck the live guide before submitting.

**Copy (273 raw characters):**

> Built Tegata at NEAR HACKATHON: invoices, pay links and payroll for small businesses using test USDC on NEAR. Tegata pays network fees and gives each payment a receipt linked to the chain.
>
> Try the Sandbox: https://tegata.84.46.247.92.sslip.io
>
> @NEARProtocol #NEARHackathon

Attach these four actual Sandbox screenshots, in this order:

1. `assets/posts/day-02-invoice.png` — make and preview an invoice.
2. `assets/posts/day-06-pay-links.png` — the pay-link detail.
3. `assets/posts/day-04-paid-receipt.png` — numbered receipt and NEAR transaction.
4. `assets/posts/day-08-payslip.png` — payroll payslip.

The app and docs returned HTTP 200 on 13 November 2026. The screenshots are copies of the repo's existing docs captures, converted to PNG without changing their content. The post still needs a human final look at X's composition and the live Sandbox.

## Follow-on campaign

[`campaign.json`](campaign.json) schedules ten posts for **15–24 November 2026 at 10:00 Lagos time**, one per day. It is a **draft**, with no X account set and no publishing authorization. Copy and image text are sourced from the README and docs. Each post identifies the Sandbox or testnet context; day 10 openly asks for feedback.

When the account is confirmed and X OAuth is set up on the Hermes publishing machine, validate the folder, update `account`, move the complete folder to `~/.hermes/campaigns/tegata-near-launch/`, and activate it only when the campaign is ready to start. The Hermes job reports links and exceptions in Sahil Server's private `#hackathon-x-campaigns` channel.

Account cleanup is a separate operation. First identify the exact account and export or inventory its existing posts. Deleting old posts is irreversible, and X's API only deletes posts owned by the authenticated account. Check the list and the authenticated identity before removing anything. Review existing follows individually; [X prohibits bulk or indiscriminate automated follow/unfollow](https://help.x.com/en/rules-and-policies/x-automation). The organiser names `@NEARProtocol` and optionally `@NearLegion` and `@NearBuilders` as relevant community accounts, but verify those profiles in X before following. Do not treat the supplied cookies as the credential handoff.
