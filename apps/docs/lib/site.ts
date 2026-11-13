/** The docs site's own constants: where things live, and the words used everywhere. */

export const SITE = {
  name: "Tegata",
  title: "Tegata docs",
  /** 手形: the old Japanese bill of exchange. */
  meaning: "a written promise to pay",
  headline: "Get paid. Pay your team. In exact dollars.",
  subheadline:
    "Invoices, pay links and payroll for small businesses, settled in USDC on NEAR. Sign in with email; Tegata pays every network fee and seals every receipt.",
  url: "https://docs.tegata.xyz",
  app: "https://tegata.xyz",
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
