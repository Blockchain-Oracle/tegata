# Diagrams

The README's diagrams are drawn in Mermaid here and rendered to PNG in `.github/assets`, once for light pages
and once for dark. The two theme files use Tegata's own tokens: washi `#F3EFE6` / sumi `#0E0C0A`, cards `#FFFCF6` /
`#1B1814`, and the seal's vermilion for borders and lines.

| Source                | Shows                                                                                                                                        | Output                      |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `readme-system.mmd`   | The web app, the worker, Postgres and NEAR, with NEAR Intents, Noah, Bitnob and Transak at the edge, and who talks to whom                   | `system-{light,dark}.png`   |
| `readme-payment.mmd`  | One payment, from opening the link to the PAID seal, and the check that decides it                                                           | `payment-{light,dark}.png`  |
| `readme-anychain.mmd` | A Live payment from another chain: the signed exact-output quote, the deposit, NEAR Intents' delivery and the check on NEAR (example values) | `anychain-{light,dark}.png` |

## Render

Needs Mermaid CLI 11 (`npm i -g @mermaid-js/mermaid-cli`). From the repository root:

```bash
for name in system payment anychain; do
  mmdc -i .github/diagrams/readme-$name.mmd -o .github/assets/$name-light.png \
    -c .github/diagrams/mermaid-light.json -b '#F3EFE6' -s 2
  mmdc -i .github/diagrams/readme-$name.mmd -o .github/assets/$name-dark.png \
    -c .github/diagrams/mermaid-dark.json -b '#0E0C0A' -s 2
done
```

If Mermaid CLI can't find a browser, point it at your Chrome with a Puppeteer config and add `-p puppeteer.json`
to each command:

```json
{ "executablePath": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }
```

## The banner and the demo cover

`banner-{light,dark}.png` (2560×1280) and `demo-cover.png` (1920×1080) are screenshots of the app's own page
`/dev/banner`, which composes the landing's parts: the headline with "exact" on seal ink, the real marks, and the
live 3D seal pressing the bill. With the web app running, capture the `#frame` element at device scale 2:

| Image              | Page                             | Viewport | Theme                                        |
| ------------------ | -------------------------------- | -------- | -------------------------------------------- |
| `banner-light.png` | `/dev/banner?bare=1&kind=banner` | 1280×640 | light                                        |
| `banner-dark.png`  | `/dev/banner?bare=1&kind=banner` | 1280×640 | dark (`localStorage["tegata.theme"]="dark"`) |
| `demo-cover.png`   | `/dev/banner?bare=1&kind=cover`  | 960×540  | either (the cover is on the lacquer stage)   |

Wait about 9 seconds after load so the seal has pressed. `receipt.png` is the real receipt No. 0003 from Abu Studio
(`/r/<token>`) at 390×844, device scale 2.

The docs use the same PNGs: copy them to `apps/docs/public/diagrams/` after rendering.
