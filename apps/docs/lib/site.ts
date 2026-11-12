/** The docs site's own constants: where things live, and the words used everywhere. */

export const SITE = {
  name: "Tegata",
  title: "Tegata docs",
  /** 手形: the old Japanese bill of exchange. */
  meaning: "a written promise to pay",
  headline: "Send an invoice. Get paid in exact dollars.",
  subheadline:
    "Invoices and pay links for small businesses, settled in USDC on NEAR: sign in with email, Tegata pays every network fee, and every payment gets a sealed receipt.",
  url: "https://tegata-docs.84.46.247.92.sslip.io",
  app: "https://tegata.84.46.247.92.sslip.io",
  repo: "https://github.com/Blockchain-Oracle/tegata",
} as const

/** Where the docs start, and the first page of each section (the top tabs). */
export const DOCS = {
  base: "/docs",
  start: "/docs/start",
  guide: "/docs/guide",
  money: "/docs/how-money-moves",
  build: "/docs/build",
} as const

/** Link previews: one size for every page. */
export const OG = { width: 1200, height: 630 } as const
