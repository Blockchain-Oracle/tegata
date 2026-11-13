// Real bank logos for the Bank page (plan 6.8 AC′). Noah's forms name 571 Nigerian, 67 Ghanaian and 21 South African
// banks but carry no logos, so: Nigeria's come from nigerianbanks.xyz (a public list with each bank's logo), matched
// to Noah's names; Ghana's and South Africa's from each bank's own website icon. Every logo is saved at 128 px under
// apps/web/public/banks/<country>/ and apps/web/lib/bank-logos.ts maps Noah's exact bank name to it.
// Run: node scripts/banks/logos.mjs (macOS: resizes with sips). noah-banks.json is a snapshot of Noah's bank lists.
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const web = join(here, "../../apps/web")
const noah = JSON.parse(readFileSync(join(here, "noah-banks.json"), "utf8"))

/** Noah's name → the logo list's slug, where names differ too much to match by words. */
const NG_OVERRIDES = {
  Opay: "paycom",
  "United Bank for Africa (UBA)": "united-bank-for-africa",
  "Moniepoint Microfinance Bank": "moniepoint-mfb-ng",
  PalmPay: "palmpay",
  "Wema Bank PLC": "wema-bank",
  "Sterling Bank PLC": "sterling-bank",
  "Polaris bank": "polaris-bank",
  "Union Bank PLC": "union-bank-of-nigeria",
  "Stanbic IBTC Bank": "stanbic-ibtc-bank",
  "EcoBank PLC": "ecobank-nigeria",
  "First City Monument Bank": "first-city-monument-bank",
  "Keystone Bank": "keystone-bank",
  "ProvidusBank PLC": "providus-bank",
  "Jaiz Bank": "jaiz-bank",
  "Unity Bank PLC": "unity-bank",
  "Globus Bank": "globus-bank",
  "Titan Trust Bank": "titan-trust-bank",
  "PayStack-Titan": "paystack-titan",
  "VFD Micro Finance Bank": "vfd",
  Carbon: "carbon",
  "Fairmoney Microfinance Bank": "fairmoney-microfinance-bank",
  Paga: "paga",
  "Lotus Bank": "lotus-bank",
  Tajwallet: "taj-bank",
  "PremiumTrust Bank": "premiumtrust-bank",
  "Parallex Bank": "parallex-bank",
  "Suntrust Bank": "suntrust-bank",
  "Rubies Microfinance Bank": "rubies-mfb",
  "Eyowo Microfinance Bank": "eyowo",
  Sparkle: "sparkle-microfinance-bank",
  "Citi Bank": "citibank-nigeria",
  "Standard Chaterted bank PLC": "standard-chartered-bank",
}

/** Ghana and South Africa: Noah's name → the bank's own website. Names Noah lists that aren't banks are left out. */
const SITES = {
  GH: {
    "GCB Bank Limited": "gcbbank.com.gh",
    "Ecobank Ghana (GH130100)": "ecobank.com",
    "Stanbic Bank Ghana Limited": "stanbicbank.com.gh",
    "Standard Chartered Bank Ghana Limited": "sc.com",
    "Standard Chartered Bk Ghana Int": "sc.com",
    "ABSA (Barclays Bank of Ghana Limited)": "absa.com.gh",
    "Fidelity Bank Ghana Ltd.": "fidelitybank.com.gh",
    "Cal Bank Limited": "calbank.net",
    "Access Bank (Ghana) PLC": "accessbankplc.com",
    "Guaranty Trust Bank (Ghana) Ltd": "gtbghana.com",
    "ZENITH BANK (GHANA) LIMITED": "zenithbank.com.gh",
    "UNITED BANK FOR AFRICA (GHANA) LTD": "ubagroup.com",
    "Agricultural Development Bank Limited": "agricbank.com",
    "National Investment Bank Ltd": "nib-ghana.com",
    "Societe Generale Ghana Limited": "societegenerale.com.gh",
    "Republic Bank (Ghana) Ltd": "republicghana.com",
    "Prudential Bank Ltd": "prudentialbank.com.gh",
    "First Atlantic Bank Ltd": "firstatlanticbank.com.gh",
    "FBN Bank (Ghana) Limited": "fbnbankghana.com",
    "Bank of Africa - Ghana": "boaghana.com",
    "Universal Merchant Bank": "myumbbank.com",
    "Consolidated Bank Ghana Limited": "cbg.com.gh",
    "OMNIBANK GHANA LIMITED": "omnibsic.com.gh",
    "GHL Bank Ltd": "ghlbank.com",
    "First National Bank Ghana Limited": "firstnationalbank.com.gh",
    "Bank of Ghana": "bog.gov.gh",
    "Arb Apex Bank Limited": "arbapexbank.com",
  },
  ZA: {
    ABSA: "absa.co.za",
    Access: "accessbankplc.com",
    "African Bank": "africanbank.co.za",
    "Bidvest Bank": "bidvestbank.co.za",
    "Capitec Bank": "capitecbank.co.za",
    "Discovery Bank": "discovery.co.za",
    "First National Bank": "fnb.co.za",
    Grindrod: "grindrodbank.co.za",
    HSBC: "hsbc.com",
    "Investec Bank": "investec.com",
    "Mercantile Bank": "mercantile.co.za",
    "Nedbank Limited": "nedbank.co.za",
    "Old Mutual Money Account": "oldmutual.co.za",
    Sasfin: "sasfin.com",
    "Standard Bank": "standardbank.co.za",
    TYME: "tymebank.co.za",
    "The Bank of New York Mellon": "bnymellon.com",
    "Windhoek Bank": "bankwindhoek.com.na",
  },
}

/** Most-used first in the bank picker; the rest follow alphabetically. */
const POPULAR = {
  NG: [
    "Access Bank",
    "Guaranty Trust Bank (GTBank)",
    "Zenith bank PLC",
    "First Bank PLC",
    "United Bank for Africa (UBA)",
    "Opay",
    "Moniepoint Microfinance Bank",
    "PalmPay",
    "Kuda",
    "Wema Bank PLC",
    "Fidelity Bank",
    "First City Monument Bank",
    "Stanbic IBTC Bank",
    "Sterling Bank PLC",
    "Union Bank PLC",
    "Polaris bank",
    "EcoBank PLC",
    "Keystone Bank",
  ],
  GH: [
    "GCB Bank Limited",
    "Ecobank Ghana (GH130100)",
    "Stanbic Bank Ghana Limited",
    "Fidelity Bank Ghana Ltd.",
    "Standard Chartered Bank Ghana Limited",
    "ABSA (Barclays Bank of Ghana Limited)",
    "Cal Bank Limited",
    "Access Bank (Ghana) PLC",
    "Guaranty Trust Bank (Ghana) Ltd",
    "ZENITH BANK (GHANA) LIMITED",
  ],
  ZA: [
    "Capitec Bank",
    "First National Bank",
    "Standard Bank",
    "ABSA",
    "Nedbank Limited",
    "TYME",
    "Discovery Bank",
    "Investec Bank",
  ],
}

const STOP = new Set(
  "plc limited ltd nigeria of the digital services service company co nig ng and microfinance mfb mfbank bank banks psb payment finance financial holdings group".split(
    " ",
  ),
)
const words = (name) =>
  name
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\(([^)]*)\)/g, " $1 ")
    .split(/[^a-z0-9]+/)
    .filter((w) => w && !STOP.has(w))

async function fetchImage(url) {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(15_000) })
    const type = res.headers.get("content-type") ?? ""
    if (!res.ok || !/image\/(png|jpeg|webp)/.test(type)) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

const width = (file) =>
  Number(
    execFileSync("sips", ["-g", "pixelWidth", file])
      .toString()
      .match(/pixelWidth: (\d+)/)?.[1] ?? 0,
  )

/** Saves a logo at 128 px; refuses icons too small to look sharp. */
function save(buffer, file, min = 96) {
  writeFileSync(file, buffer)
  if (width(file) < min) {
    rmSync(file)
    return false
  }
  execFileSync("sips", ["-Z", "128", "-s", "format", "png", file, "--out", file], {
    stdio: "ignore",
  })
  return true
}

const out = {}
const tmp = join(here, ".tmp")
mkdirSync(tmp, { recursive: true })

// Nigeria.
mkdirSync(join(web, "public/banks/ng"), { recursive: true })
const list = await (await fetch("https://nigerianbanks.xyz/")).json()
const bySlug = new Map(
  list.filter((b) => !b.logo.includes("default-image")).map((b) => [b.slug, b]),
)
const byWords = new Map()
for (const b of bySlug.values())
  if (!byWords.has(words(b.name).join(" "))) byWords.set(words(b.name).join(" "), b)
for (const name of noah.NG) {
  const w = words(name)
  const bank =
    bySlug.get(NG_OVERRIDES[name]) ??
    byWords.get(w.join(" ")) ??
    byWords.get(w.slice(0, 2).join(" ")) ??
    byWords.get(w.slice(0, 1).join(" "))
  if (!bank) continue
  const file = join(web, "public/banks/ng", `${bank.slug}.png`)
  const image = await fetchImage(bank.logo)
  if (image && save(image, file)) out[name] = `/banks/ng/${bank.slug}.png`
}

// Ghana and South Africa: the bank's own touch icon, else the largest icon Google has for it.
for (const [country, sites] of Object.entries(SITES)) {
  const dir = join(web, "public/banks", country.toLowerCase())
  mkdirSync(dir, { recursive: true })
  for (const [name, domain] of Object.entries(sites)) {
    if (!noah[country].includes(name)) continue
    const slug = domain.replace(/[^a-z0-9]+/g, "-")
    const file = join(dir, `${slug}.png`)
    for (const url of [
      `https://${domain}/apple-touch-icon.png`,
      `https://www.${domain}/apple-touch-icon.png`,
      `https://${domain}/apple-touch-icon-precomposed.png`,
      `https://www.google.com/s2/favicons?domain=${domain}&sz=256`,
    ]) {
      const image = await fetchImage(url)
      if (image && save(image, file, url.includes("google.com") ? 64 : 96)) {
        out[name] = `/banks/${country.toLowerCase()}/${slug}.png`
        break
      }
    }
  }
}
rmSync(tmp, { recursive: true, force: true })

const ts = `// Generated by scripts/banks/logos.mjs: Noah's exact bank name → its logo (128 px, served from public/banks).
// Banks without one fall back to a monogram disc.

export const BANK_LOGOS: Record<string, string> = ${JSON.stringify(out, null, 2)}

/** The banks most people use, first in the bank picker. */
export const POPULAR_BANKS: Record<string, readonly string[]> = ${JSON.stringify(POPULAR, null, 2)}
`
writeFileSync(join(web, "lib/bank-logos.ts"), ts)
const counts = Object.fromEntries(
  ["ng", "gh", "za"].map((c) => [
    c,
    Object.values(out).filter((p) => p.startsWith(`/banks/${c}/`)).length,
  ]),
)
console.log("logos", counts)
