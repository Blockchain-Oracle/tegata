"use client"

import { Monitor, Moon, Smartphone, Sun, Volume2, VolumeX } from "lucide-react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { createContext, useContext, useEffect, useState } from "react"
import { Lockup } from "@/components/brand/seal"
import { Segmented } from "@/components/kit/segmented"
import { setFeedback, useFeedback } from "@/lib/feedback"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

export const DEV_PAGES = [
  { href: "/dev/brand", label: "Brand" },
  { href: "/dev/color", label: "Colour & type" },
  { href: "/dev/kit", label: "Kit" },
  { href: "/dev/states", label: "States" },
  { href: "/dev/motion", label: "Motion & sound" },
  { href: "/dev/marks", label: "Logos" },
  { href: "/dev/flows/signin", label: "Sign-in" },
  { href: "/dev/flows/welcome", label: "Welcome" },
  { href: "/dev/flows/home", label: "Home & Send" },
  { href: "/dev/flows/links", label: "Pay links" },
  { href: "/dev/flows/pay", label: "Pay & receipt" },
] as const

type Network = "testnet" | "mainnet"
const DevContext = createContext<{ network: Network; phone: boolean }>({
  network: "testnet",
  phone: false,
})
export const useDev = () => useContext(DevContext)

export function DevChrome({ children }: { children: React.ReactNode }) {
  const bare = useSearchParams().get("bare") === "1"
  // Inside the phone frame's iframe: the page alone, at real phone breakpoints.
  if (bare) return <div className="min-h-dvh bg-background px-0">{children}</div>
  return <DevFrame>{children}</DevFrame>
}

function DevFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { resolvedTheme, setTheme } = useTheme()
  const { sound } = useFeedback()
  const [network, setNetwork] = useState<Network>("testnet")
  const [phone, setPhone] = useState(false)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <DevContext.Provider value={{ network, phone }}>
      <div className="min-h-dvh bg-background" data-network={network}>
        <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-[1320px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <Link href="/dev" className="flex items-center gap-2">
              <Lockup size={30} />
              <span className="rounded-full bg-secondary px-2.5 py-1 text-meta font-semibold text-muted-foreground">
                Design review
              </span>
            </Link>
            <nav className="order-3 -mx-1 flex w-full gap-1 overflow-x-auto px-1 pb-1 sm:order-none sm:w-auto sm:flex-1 sm:pb-0">
              {DEV_PAGES.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  className={cn(
                    "press shrink-0 rounded-[10px] px-3 py-2 text-[14px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                    pathname === p.href &&
                      "bg-foreground text-background hover:bg-foreground hover:text-background",
                  )}
                >
                  {p.label}
                </Link>
              ))}
            </nav>
            <div className="ms-auto flex items-center gap-2">
              <Segmented
                label="Network"
                value={network}
                onValueChange={(v) => setNetwork(v as Network)}
                options={[
                  { value: "testnet", label: "Sandbox" },
                  { value: "mainnet", label: "Live" },
                ]}
              />
              <IconToggle
                label={mounted && resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
              >
                {mounted && resolvedTheme === "dark" ? <Sun /> : <Moon />}
              </IconToggle>
              <IconToggle
                label={phone ? "Desktop width" : "Phone width"}
                onClick={() => setPhone((p) => !p)}
              >
                {phone ? <Monitor /> : <Smartphone />}
              </IconToggle>
              <IconToggle
                label={sound ? "Mute sounds" : "Play sounds"}
                onClick={() => setFeedback({ sound: !sound })}
              >
                {sound ? <Volume2 /> : <VolumeX />}
              </IconToggle>
            </div>
          </div>
        </header>
        {phone ? (
          <div className="flex justify-center px-4 pt-6 pb-24">
            <div className="rounded-[52px] bg-black p-3 shadow-float">
              <iframe
                title="Phone preview"
                src={`${pathname}?bare=1`}
                className="h-[844px] w-[390px] rounded-[40px] bg-background"
              />
            </div>
          </div>
        ) : (
          <main className="mx-auto max-w-[1320px] px-4 pb-24 sm:px-6">{children}</main>
        )}
      </div>
    </DevContext.Provider>
  )
}

function IconToggle({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="press grid size-10 place-items-center rounded-full bg-secondary text-foreground hover:bg-plate-pressed [&_svg]:size-[18px]"
    >
      {children}
    </button>
  )
}

/** A titled section of the review page. */
export function Section({
  title,
  note,
  children,
  className,
}: {
  title: string
  note?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn("flex flex-col gap-4 pt-10", className)}>
      <div className="flex flex-col gap-1">
        <h2 className="display text-[30px] leading-none">{title}</h2>
        {note ? <p className="max-w-2xl text-[15px] text-muted-foreground">{note}</p> : null}
      </div>
      {children}
    </section>
  )
}

/** One specimen with its label. */
export function Specimen({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-3 rounded-[20px] bg-card p-5", className)}>
      <span className="text-meta font-semibold text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
