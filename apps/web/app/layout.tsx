import "./globals.css"

import type { Metadata, Viewport } from "next"
import { Archivo, DM_Mono } from "next/font/google"

import { Toaster } from "@/components/ui/sonner"

import { Providers } from "./providers"

/** Applies the remembered theme before the first paint, so dark mode never flashes light. */
const THEME_SCRIPT = `try{if(localStorage.getItem("tegata.theme")==="dark"){document.documentElement.classList.add("dark");document.documentElement.style.colorScheme="dark"}}catch(e){}`

// One family for money and words: Archivo's width axis gives the condensed figures (62) and the interface (100).
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
})
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
  display: "swap",
})

export const metadata: Metadata = {
  title: { default: "Tegata", template: "%s · Tegata" },
  description:
    "Invoices and pay links for small businesses, settled in USDC on NEAR: sign in with email, Tegata pays every network fee, and every payment gets a sealed receipt.",
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f5f5" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${dmMono.variable}`} suppressHydrationWarning>
      <head>
        {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed, first-party script with no input. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Toaster position="top-center" />
      </body>
    </html>
  )
}
