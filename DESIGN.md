# Tegata design

The single source for every visual, motion and sound decision. Every colour, size, duration and cue in the app
resolves to a token named here (values live in `apps/web/app/globals.css` and `apps/web/lib/design/*`).
`/dev` shows every part in every state on the live tokens.

## Direction

- One line: **quiet paper plates for the work, a lit vermilion stage for the moments that matter, money in heavy
  condensed figures that roll, and a seal that presses when money settles.**
- No screen is only grey and black: each has a lit stage, a story field, a real mark or a seal.
- The shell is calm so the things that move are the ones that matter: a figure rolling, a step completing,
  a seal pressing onto a paid invoice.
- Light is the default. Dark is an adaptation, not an inversion.
- Depth is one step lighter fill. Never a border, never a shadow on content.

The plate grammar, press feel, state rules and sound palette come from the owner's earlier apps (Senryo and Kawase).

## Signature: the seal

A Japanese business signs with a seal, not a pen. Tegata's mark is a square company seal reading 手形.
Every business gets its own round seal, cut from its name the moment the account opens.

- The seal presses once (never loops) when: sign-in succeeds, the account opens, an invoice is paid,
  a receipt or payslip is issued.
- Press: scale 1.12 → 0.98 → 1 and y −8 → 0 over 220 ms, with the stamp cue. Reduced motion: a 100 ms fade.
- Vermilion is the seal's colour. It is also the selected state and the focus ring. It is never an error.

## Palette (light / dark)

Washi and sumi (13 Nov 2026, carried from the landing to the whole app): warm paper by day, warm ink-black at night,
vermilion only where a seal would be.

| Token                                    | Light                                                                               | Dark                              | Used for                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| background (washi)                       | `#F3EFE6`                                                                           | `#0E0C0A`                         | the page                                                                 |
| card                                     | `#FFFCF6`                                                                           | `#1B1814`                         | a group on a page                                                        |
| secondary, muted, input                  | `#E9E3D6`                                                                           | `#262119`                         | quiet plates, inputs, a group inside a sheet                             |
| plate-pressed, accent                    | `#DFD8C9`                                                                           | `#2E2820`                         | pressed rows, hover plate, segmented thumb                               |
| foreground (sumi)                        | `#16130F`                                                                           | `#F2EDE4`                         | text 1                                                                   |
| muted-foreground / text-3                | `#5B544A` / `#6B6357`                                                               | `#B8AFA2` / `#968C7F`             | text 2 and 3                                                             |
| primary / on it                          | `#16130F` / `#FFFCF6`                                                               | `#F2EDE4` / `#0E0C0A`             | the one main action; pressed `#2B2620` / `#DCD5CA`                       |
| rule                                     | `#DCD4C4`                                                                           | `#2C2620`                         | print hairlines only (running heads, ledgers), never a box               |
| paper                                    | `#FFFCF6`, sunk `#F3EFE6`, rule `#E9E3D6`, text `#5B544A` / `#6B6357`               | same (paper stays paper)          | receipts, invoices, slips, every object on a stage                       |
| shu (seal) / on it                       | `#FF4F00` / `#000000`                                                               | same                              | the seal, selected controls, the focus ring, badges                      |
| stage, shu tone                          | lit field: `#FF4F00` base, `#FF7A2E` and `#FFB38A` radial lights, white blur, grain | same (stays lit)                  | money moments: the balance, the pay page header, a receipt, a send       |
| stage, lacquer tone                      | sumi `#120D0A`, a vermilion glow rising from below, the desk's dot grid, grain      | same                              | big surfaces: sign-in, onboarding, cards, bank, opening Live             |
| story fields                             | matcha `#C8F06A` · sora `#A9D8FF` · sakura `#FFC2D6` · kin `#FFD23F` · ai `#1B1F5E` | deep on the landing               | onboarding scenes, empty states, landing story cards, Home's first steps |
| seal-ink                                 | `#B23700`                                                                           | `#FF8A52`                         | seal colour as text on a plate, links                                    |
| seal-wash                                | `#FFE6D6`                                                                           | `#3A2015`                         | a selected row                                                           |
| up / down                                | `#2F7A00` / `#C8283F`                                                               | `#B5F543` / `#FF647C`             | money in / money out and failures, always with a sign or a word          |
| up-surface / down-surface / warn-surface | `#ECF5D8` / `#FDECEB` / `#FBEBCB`                                                   | `#1E2A0C` / `#3A1A20` / `#332719` | chips and panels                                                         |
| warn                                     | `#8A5800`                                                                           | `#F2B85C`                         | warnings                                                                 |
| skeleton                                 | `#E2DBCD`                                                                           | `#2A251F`                         | loading geometry                                                         |
| scrim                                    | `#16130FB3`                                                                         | `#000000B3`                       | under sheets and ⌘K                                                      |

Shadows are warm (sumi `#16130F` at low alpha), never neutral black. Emails and PDFs use the same paper values.

Sandbox is said by the word "Sandbox" and a dashed rim on the mode capsule, never by a hue.
Text pairs stay at 4.5:1 or better; `pnpm check:contrast` fails the build otherwise.

## Type

One family does both jobs, so figures and words share the same bones.

- **Archivo** (variable: width 62 to 125, weight 100 to 900).
  - Display: width 62, weight 900, tracking −0.01 em, tabular lining figures. Money and page titles only.
  - Interface: width 100, weights 400 / 500 / 600 / 700.
- **DM Mono** 400 / 500 for account names, transaction hashes and codes.
- The seal's Japanese glyphs are drawn outlines. No Japanese font is shipped.

| Role              | Size / line            | Face      |
| ----------------- | ---------------------- | --------- |
| display-hero      | 64 / 64                | display   |
| display-balance   | 52 / 56                | display   |
| display-price     | 40 / 44                | display   |
| page-title        | 32 / 36                | display   |
| step-title        | 28 / 34, 600, −0.02 em | interface |
| sheet-title       | 24 / 28, 600           | interface |
| section-title     | 20 / 24, 600           | interface |
| row-title, button | 17 / 22, 600           | interface |
| row, body         | 16 / 22, 500 and 400   | interface |
| detail            | 14 / 18                | interface |
| meta              | 12 / 16                | interface |

Sentence case. No tracked uppercase labels.

## Shape, space, elevation

- Radius: 8 chips · 12 buttons and inputs · 16 rows and tiles · 20 groups · 24 sheets, the stage, the rail · 32 hero.
  Full pills only for the mode capsule, chips and the phone dock.
- Buttons 56 high (48 secondary, 44 compact). Inputs 56. Touch targets 44 or more.
- Space: a 4 grid, 4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 64.
- Elevation only on the rail and dock (`0 8 24 #0003`), sheets (`0 -4 16 #0000001F`) and a receipt
  (`0 8 24 #0000001F`). Everything else is flat.

## Motion

| Token       | Value                                                                       |
| ----------- | --------------------------------------------------------------------------- |
| press       | to 0.97 scale, 100 ms in, 160 ms out                                        |
| selection   | 170 ms                                                                      |
| figure roll | 260 ms, `cubic-bezier(0.22, 1, 0.36, 1)`                                    |
| step change | old step fades and slides −12 px in 160 ms; new step rises 12 px in 320 ms  |
| stagger     | 40 ms apart, each rises 10 px over 320 ms                                   |
| sheet       | in 480 ms, out 240 ms, `cubic-bezier(0.32, 0.72, 0, 1)`                     |
| ease        | `cubic-bezier(0.2, 0.8, 0.2, 1)`                                            |
| springs     | selector 260 / 30 · active pill 500 / 36 · press 600 / 30 · layout 420 / 40 |
| seal press  | 220 ms, scale 1.12 → 0.98 → 1                                               |
| skeleton    | opacity 0.65 ↔ 1 over 1200 ms                                               |

Reduced motion: travel becomes a 100 ms crossfade, shimmer and skeletons stand still, digits swap.

Stage tones: `shu` for money moments (the balance, send, pay links, the pay page header, receipts, emails), `lacquer`
for big surfaces (sign-in, onboarding, cards, bank, payroll, opening Live, the referral join page, the share
image). Story fields go deep at night (`--field-ink` flips to washi on them).

## Sound and touch

One call: `fire(event, { cue, identity })` in `apps/web/lib/feedback`.

| Cue                    | Kit        | Plays when                                      |
| ---------------------- | ---------- | ----------------------------------------------- |
| tap                    | sine       | a main action is pressed                        |
| toggle                 | sine       | a switch, the mode capsule                      |
| step                   | sine       | an onboarding step lands, a task step completes |
| sheetOpen / sheetClose | sine       | a sheet                                         |
| error                  | sine       | something failed                                |
| received               | piano      | money arrived                                   |
| sent                   | piano      | money left                                      |
| confirmed              | piano      | a result is confirmed                           |
| stamp                  | industrial | the seal presses                                |
| celebrate              | piano      | once, when the account opens                    |

- Nothing plays for typing, hover or moving between pages.
- An outcome cue plays once per identity (a transaction hash, a payment id); a remount never replays it.
- A speaker switch turns sound off; the choice is kept on the device. Phones also get a short vibration.
- The cues are SND's designed kits (snd.dev), trimmed and levelled by `scripts/prepare-sounds.mjs`.
  Raw kit files never enter the repo.

## States (every surface)

- **Loading:** a skeleton shaped like the real layout, shown after 120 ms and held at least 300 ms.
  Never a spinner page, never a made-up $0.
- **Empty:** says why and names the next action.
- **Error:** says what still works and offers one action; technical text behind a disclosure.
- **Waits:** a short verb that shimmers ("Opening your account"), elapsed seconds after 3 s,
  "Still waiting · Retry" at about 15 s.
- **Money in flight:** the button never looks disabled; its face names the phase, steps run under it,
  and it turns into its receipt. A failure always says whether money moved.

## Page grammar

- One hero figure per screen. At most four facts at rest. No explainer sentence under a control.
- Real marks for every chain, coin and partner, in their own colours, never tinted.
- Desktop: a floating rail and one stage with 24 px corners. Sheets become right drawers.
- Phone: a dock at the bottom; the action is a 56 px plate above the keyboard.

## Where each part comes from

Parts come from the owner's earlier web kits (Senryo, Kawase), which were sourced from
21st.dev, or are installed from 21st.dev directly. Hand-built parts are named as such.

| Part                                                   | Source                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------- |
| Button                                                 | 21st originui/button (143), Senryo spec                             |
| Segmented                                              | 21st ddoemonn/segmented-control (23552)                             |
| Switch                                                 | 21st serafimcloud/switch (21948)                                    |
| Code field                                             | 21st ddoemonn/otp-input (23543) on `input-otp`                      |
| Hold to confirm                                        | 21st ddoemonn/hold-to-confirm (23527)                               |
| Slide to confirm                                       | 21st starc007/slide-action-button (29304)                           |
| Task steps                                             | 21st ddoemonn/task-steps (23569)                                    |
| Progress bar                                           | 21st ddoemonn/progress-bar (23549)                                  |
| Text shimmer                                           | 21st ibelick/text-shimmer (1641)                                    |
| Loading state                                          | 21st theshanelevine/loading-state (23591)                           |
| Skeleton                                               | 21st shadcn/skeleton (1588)                                         |
| Empty and error states                                 | 21st serafimcloud/empty-state (1435), cnippet-dev/v-alert-7 (23621) |
| Rolling figures                                        | 21st barvian/number-flow (1444)                                     |
| Toast                                                  | 21st shadcn/sonner (886)                                            |
| Sheet and drawer                                       | 21st shadcn/drawer (1245) on `vaul`                                 |
| Disclosure                                             | 21st ibelick/disclosure (851)                                       |
| Rail                                                   | 21st unlumen/sidebar-001 (21517), Senryo's CSS pill                 |
| Phone dock                                             | 21st soralabs/dock-nav (19177)                                      |
| Mode capsule                                           | 21st haydenbleasel/pill (1600)                                      |
| Account set-up steps                                   | 21st amanshakya307/onboard-card (3754)                              |
| The seal, the sign-up stage, the coin-and-chain picker | hand-built; no candidate exists                                     |

## Banned

- Inter, Roboto or a system font as the brand face.
- Borders on content, shadows on groups, glass on content. Gradients and glow only as the stage's light (shu and lacquer) and the landing's desk.
- Tracked uppercase labels, explainer sentences under controls, text dumps.
- Full-pill main buttons. Purple. Emoji as icons.
- A spinner where a skeleton or an inline message belongs.
- Colour as the only signal for network, direction, success or failure.
- Tinting a logo, or a letter disc where a real mark exists.
- Sample names and figures anywhere outside `/dev`. The word "gas" anywhere.

## The landing page (revamp, 13 Nov 2026)

The landing is the one surface allowed to perform. The app stays calm; `/` tells the whole story of a bill, in
light and dark, with one real 3D object and motion that always shows something true about the product.
References studied live (Framer marketplace, 13 Nov 2026) and what each one gives us:

| Reference           | Taken                                                                                        |
| ------------------- | -------------------------------------------------------------------------------------------- |
| Cardora Finance     | One 3D object as the hero, a dark field lit by one warm glow, huge type, scroll-lit lines    |
| FintechX            | The before/after dial, the integration orbit around one mark, the tree from one node to many |
| Verity              | Live product UI that plays itself ("shows its work"), figures that count up, calm dark mode  |
| Parallel — Finance  | Printed paper: running heads, words that ink in as you read, sources as numbered footnotes   |
| Canvas              | Hand-set emphasis: a word set on a coloured block inside a headline; stats inside a grid     |
| Ballance            | "Who it's for" as tabs that swap one big picture                                             |

### Direction: washi and shu

- **Light:** warm washi paper, sumi ink, vermilion only where a seal would be. **Dark:** sumi night with one
  vermilion glow rising from below, like Cardora's field; paper objects stay paper.
- Colour roles, not one accent: **shu** = the seal, the hero light, the one main highlight per section; **matcha** =
  money arrived; **ai** (indigo) = NEAR and proof; **kin** = payroll; **sora** = pay links; **sakura** = cards.
  The story fields are used as small fills and highlight blocks, never as whole candy sections.
- Every figure on the page is real: the README's sourced $1,250 example, the 11 routes in `lib/routes.ts`, the
  measured fees, and testnet transactions that open on the explorer. No invented customers, quotes or stats.

### Tokens (scoped to `.landing`, so the app is untouched)

| Token          | Light     | Dark      | Use                                     |
| -------------- | --------- | --------- | --------------------------------------- |
| washi (page)   | `#F3EFE6` | `#0E0C0A` | background                              |
| washi-card     | `#FFFCF6` | `#1B1814` | a plate on the page                     |
| washi-sunk     | `#E9E3D6` | `#262119` | a plate inside a plate, inputs, chips   |
| ink            | `#16130F` | `#F2EDE4` | text 1, the main action                 |
| ink-2          | `#5B544A` | `#B8AFA2` | text 2                                  |
| ink-3          | `#6B6357` | `#968C7F` | text 3, footnotes                       |
| rule           | `#DCD4C4` | `#2C2620` | print hairlines (running heads, ledger) |
| shu / shu-ink  | `#FF4F00` / `#B23700` | `#FF4F00` / `#FF8A52` | seal, highlight / shu as text |

Every text pair is 4.5:1 or better (checked); `#FF4F00` is never small text on washi. Hairlines are print rules
(a running head, a ledger row), never a box around content.

### Type

- Archivo condensed 900 (`display`) for the headline and every figure; Archivo 100 for words; DM Mono for
  memos, accounts and hashes. Running heads read `§ 03 · How a payment moves`, sentence case, DM Mono 13.
- 手形 appears as the real seal glyph outlines (no Japanese font shipped), set vertically as a watermark.

### Sections, top to bottom

1. **Nav:** a floating capsule that tightens on scroll (Aceternity resizable navbar): lockup, How it works,
   Payroll, Proof, Docs, the theme switch (Magic UI animated theme toggler, a circle wipe), Sign in, Open an account.
2. **Hero:** the promise on the left (cut in character by character, after Fancy's vertical cut reveal but in CSS
   keyframes so it never waits on hydration), the 3D hanko on the right.
   Facts under the buttons: 0 NEAR to hold · 11 coin-and-chain routes · 1 approval pays everyone.
3. **Marquee:** the 11 coin-on-chain marks a client can pay from (Magic UI marquee), "settled as USDC on NEAR".
4. **Before / after:** "A $1,250 invoice to a client abroad." A dial flips the plate between the usual way (card
   −$67.80, wire −$6.11, four manual stablecoin steps) and Tegata ($1,250.00 exactly). Sources as footnotes.
5. **How a payment moves:** pinned scroll (Aceternity sticky scroll reveal, on page scroll): send → they pay
   their way → NEAR decides paid (the memo, receiver, amount, final) → your seal stamps the receipt. The object
   on the right is the real product part for each step (invoice paper, rails with marks, a transaction readout,
   the receipt slip with the business seal).
6. **Live quote:** the existing calculator beside an orbit of the 11 marks around the Tegata seal (Magic UI
   orbiting circles). Real NEAR Intents dry quotes.
7. **Payroll:** a run that plays itself (Magic UI animated list): rows to a Tegata account, a NEAR account and
   USDT on Tron tick to Paid in one transaction, then the seal presses. Autopilot as a fact, marked Sandbox.
8. **Across borders:** a cobe globe (Magic UI globe) with Lagos, Accra, Johannesburg and the euro account; ₦,
   GH₵, R and € with round flags; a Sandbox pill.
9. **Everything else:** a bento (Magic UI bento grid, reskinned): pay links and QR, counter, checkout API with a
   real `curl`, books (CSV, statement, reconciliation), Send, NEAR wallet sign-in, cards ("Opening soon").
10. **Proof on NEAR:** a scroll-inked line (Magic UI text reveal) "Nothing is paid until NEAR says so.", then a
    ledger of real testnet transactions with explorer links and the measured fees.
11. **Built on NEAR:** a tree with travelling beams (Magic UI animated beam): Tegata's seal to named accounts,
    meta transactions, USDC, NEAR Intents, NEAR Connect and the autopilot contract; partners at the licensed edge.
12. **Questions:** shadcn accordion, honest answers (custody, cost, Sandbox and Live).
13. **Close and footer:** "Open your account in a minute." on the stage; a giant 手形 / Tegata set in the footer.

### The 3D hanko (hand-built: no premium equivalent)

- three.js, loaded only on `/` after first paint; a static seal-on-bill fallback for no WebGL and reduced motion.
- A square company seal: a black horn body with a thin kin band, the face cut from the real 手形 outlines
  (`lib/brand/glyphs.ts`, extruded) and inked vermilion. A bill lies on the desk below it.
- Coins of the 11 routes orbit the seal. Once, after load: the seal turns face-down, presses the bill (soft shadow
  darkens, a short squash), lifts, and the bill's status turns Paid with the ink impression. Clicking the seal
  presses again, with the `stamp` cue (sound only ever follows a click).
- Pointer parallax of a few degrees; the scene pauses when off screen; DPR capped at 1.75.
- **Onboarding (welcome):** the same desk on the lacquer stage, with the business's own round seal (丸印) on a
  lathe-turned hanko. Its face is re-cut on canvas as the name is typed (drawn upside down so its print reads true);
  the bill reads "Pay to the order of {name}" and the pay address; the coins orbit while the address is chosen; the
  opening steps and the QR float on paper below. When the account opens the seal presses once (`stamp`, then
  `celebrate`) and the bill turns Open with the "OPEN · date" ink. Without WebGL or with reduced motion, the 2D bill
  stage stands in (`components/onboarding/desk-stage.tsx`, `bill-stage.tsx`).

### Motion on the landing

- Headline lines cut in 80 ms apart on load; section titles rise 12 px in 320 ms when they enter.
- Figures count with NumberFlow; the orbit turns once per 60 s; beams travel every 4 s.
- Reduced motion: everything is placed at its end state; the hanko is a still image; nothing loops.
