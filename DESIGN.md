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

Sources (what each one owns):

| Source                                                  | Owns                                                                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| Senryo and Kawase (the owner's earlier apps)            | Plate grammar, rows not boxes, marks not dots, press feel, state rules, the money lifecycle, the sound palette     |
| Bento "claim your link", Cosmos sign-up (Refero)        | Sign-up as a split screen: a form on one side, a live object that reacts as you type on the other                  |
| Portrait with Privy (Refero flow 11790)                 | Email code inside our own page; named stages while the account is made                                             |
| Delphi "claim your handle" (Refero)                     | One question per step, a thin progress line, availability said inside the field                                    |
| Privy (Refero style fc2dd49a, checked live on privy.io) | The split product-stage opening; colour lives in stages and story panels, not chrome; sign-in rows with real logos |
| Wise (Refero style da2edc37)                            | Landing page only: the promise above a working calculator                                                          |

## Signature: the seal

A Japanese business signs with a seal, not a pen. Tegata's mark is a square company seal reading 手形.
Every business gets its own round seal, cut from its name the moment the account opens.

- The seal presses once (never loops) when: sign-in succeeds, the account opens, an invoice is paid,
  a receipt or payslip is issued.
- Press: scale 1.12 → 0.98 → 1 and y −8 → 0 over 220 ms, with the stamp cue. Reduced motion: a 100 ms fade.
- Vermilion is the seal's colour. It is also the selected state and the focus ring. It is never an error.

## Palette (light / dark)

| Token                                    | Light                                                                               | Dark                              | Used for                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| background                               | `#F5F5F5`                                                                           | `#111111`                         | the page                                                                 |
| card                                     | `#FFFFFF`                                                                           | `#1C1C1C`                         | a group on a page                                                        |
| secondary, muted, input                  | `#ECECEC`                                                                           | `#292929`                         | quiet plates, inputs, a group inside a sheet                             |
| plate-pressed                            | `#E2E2E2`                                                                           | `#363636`                         | pressed rows, hover plate, segmented thumb                               |
| foreground                               | `#000000`                                                                           | `#F5F5F5`                         | text 1                                                                   |
| muted-foreground / text-3                | `#666666` / `#6E6E6E`                                                               | `#B8B8B8` / `#A0A0A0`             | text 2 and 3                                                             |
| primary / on it                          | `#000000` / `#FFFFFF`                                                               | `#F5F5F5` / `#000000`             | the one main action; pressed `#252525` / `#DEDEDE`                       |
| shu (seal) / on it                       | `#FF4F00` / `#000000`                                                               | same                              | the seal, selected controls, the focus ring, badges                      |
| stage                                    | lit field: `#FF4F00` base, `#FF7A2E` and `#FFB38A` radial lights, white blur, grain | same (stays lit)                  | sign-in, onboarding, landing hero, the balance tile, the pay page header |
| story fields                             | matcha `#C8F06A` · sora `#A9D8FF` · sakura `#FFC2D6` · kin `#FFD23F` · ai `#1B1F5E` | same                              | onboarding scenes, empty states, landing story cards, Home's first steps |
| seal-ink                                 | `#B23700`                                                                           | `#FF8A52`                         | seal colour as text on a plate, links                                    |
| seal-wash                                | `#FFE9DF`                                                                           | `#3A2015`                         | a selected row                                                           |
| up / down                                | `#2F7A00` / `#C8283F`                                                               | `#B5F543` / `#FF647C`             | money in / money out and failures, always with a sign or a word          |
| up-surface / down-surface / warn-surface | `#EEF9DC` / `#FDE7EA` / `#FFF0D5`                                                   | `#1E2A0C` / `#3A1A20` / `#332719` | chips and panels                                                         |
| warn                                     | `#8A5800`                                                                           | `#F2B85C`                         | warnings                                                                 |
| skeleton                                 | `#DEDEDE`                                                                           | `#363636`                         | loading geometry                                                         |
| scrim                                    | `#000000B3`                                                                         | `#000000B3`                       | under sheets                                                             |

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

Parts are ported from the owner's own web kits (Senryo web, Kawase `ui-web`), which were sourced from
21st.dev, or installed from 21st.dev directly. Hand-built parts are named as such.

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
- Borders on content, shadows on groups, gradients, glow, glass on content.
- Tracked uppercase labels, explainer sentences under controls, text dumps.
- Full-pill main buttons. Purple. Emoji as icons.
- A spinner where a skeleton or an inline message belongs.
- Colour as the only signal for network, direction, success or failure.
- Tinting a logo, or a letter disc where a real mark exists.
- Sample names and figures anywhere outside `/dev`. The word "gas" anywhere.
