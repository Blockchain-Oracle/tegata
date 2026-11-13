# Diagrams

The README's diagrams are drawn in Mermaid here and rendered to PNG in `.github/assets`, once for light pages
and once for dark. The two theme files use Tegata's own tokens: paper `#F5F5F5` / `#111111`, cards `#FFFFFF` /
`#1C1C1C`, and the seal's vermilion for borders and lines.

| Source               | Shows                                                                              | Output                     |
| -------------------- | ---------------------------------------------------------------------------------- | -------------------------- |
| `readme-system.mmd`  | The web app, the worker, Postgres and NEAR, with NEAR Intents, Noah, Bitnob and Transak at the edge, and who talks to whom | `system-{light,dark}.png`  |
| `readme-payment.mmd` | One payment, from opening the link to the PAID seal, and the check that decides it | `payment-{light,dark}.png` |
| `readme-anychain.mmd` | A Live payment from another chain: the signed exact-output quote, the deposit, NEAR Intents' delivery and the check on NEAR (example values) | `anychain-{light,dark}.png` |

## Render

Needs Mermaid CLI 11 (`npm i -g @mermaid-js/mermaid-cli`). From the repository root:

```bash
for name in system payment anychain; do
  mmdc -i .github/diagrams/readme-$name.mmd -o .github/assets/$name-light.png \
    -c .github/diagrams/mermaid-light.json -b '#F5F5F5' -s 2
  mmdc -i .github/diagrams/readme-$name.mmd -o .github/assets/$name-dark.png \
    -c .github/diagrams/mermaid-dark.json -b '#111111' -s 2
done
```

If Mermaid CLI can't find a browser, point it at your Chrome with a Puppeteer config and add `-p puppeteer.json`
to each command:

```json
{ "executablePath": "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" }
```

## The banner and the demo cover

`banner-{light,dark}.{svg,png}` (2560×1280) and `demo-cover.{svg,png}` (1920×1080) are drawn by
`scripts/brand/banner.mjs` from the real seal (`apps/web/app/icon.svg`), the real marks in
`apps/web/public/marks` and Archivo, with every letter turned into a path so the SVG renders the same anywhere.
The PNGs are made with `rsvg-convert` (`brew install librsvg`):

```bash
node scripts/brand/banner.mjs
```

The docs use the same PNGs: copy them to `apps/docs/public/diagrams/` after rendering.
