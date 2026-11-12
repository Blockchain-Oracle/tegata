import type { Metadata, Viewport } from "next"
import { Archivo, DM_Mono } from "next/font/google"

import { Provider } from "@/components/provider"
import { OG, SITE } from "@/lib/site"

import "./global.css"

// The app's faces: Archivo for everything (its width axis gives the condensed titles), DM Mono for accounts,
// hashes and code.
const archivo = Archivo({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-archivo",
})
const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-dm-mono",
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `${SITE.name}: ${SITE.headline}`, template: `%s · ${SITE.title}` },
  description: SITE.subheadline,
  applicationName: SITE.title,
  openGraph: {
    siteName: SITE.title,
    type: "website",
    images: [{ url: "/og/home.png", width: OG.width, height: OG.height }],
  },
  twitter: { card: "summary_large_image" },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F5F5F5" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${dmMono.variable} font-sans`}
      suppressHydrationWarning
    >
      <body className="flex min-h-screen flex-col">
        <Provider>{children}</Provider>
      </body>
    </html>
  )
}
