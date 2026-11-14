"use client"

// The landing nav (DESIGN.md "The landing page" §1): Aceternity's resizable navbar on washi, the Magic UI theme
// switch (a circle wipe, remembered with the app's own `tegata.theme`), Sign in and Open an account.
import Link from "next/link"
import { useState } from "react"

import { Lockup } from "@/components/brand/seal"
import { buttonVariants } from "@/components/kit/button-variants"
import { AnimatedThemeToggler } from "@/components/ui/animated-theme-toggler"
import {
  MobileNav,
  MobileNavHeader,
  MobileNavMenu,
  MobileNavToggle,
  NavBody,
  Navbar,
  NavItems,
} from "@/components/ui/resizable-navbar"
import { fire } from "@/lib/feedback"
import { LINKS } from "@/lib/links"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

const ITEMS = [
  { name: "How it works", link: "#how" },
  { name: "Payroll", link: "#payroll" },
  { name: "Proof", link: "#proof" },
  { name: "Demo", link: LINKS.demoVideo },
  { name: "Docs", link: LINKS.docs },
]

function ThemeSwitch() {
  const { resolvedTheme, setTheme } = useTheme()
  return (
    <AnimatedThemeToggler
      theme={resolvedTheme}
      onThemeChange={(t) => {
        setTheme(t)
        fire("tick", { cue: "toggle" })
      }}
      duration={520}
      aria-label={resolvedTheme === "dark" ? "Switch to light" : "Switch to dark"}
      className="grid size-10 place-items-center rounded-full text-foreground transition-colors hover:bg-secondary [&_svg]:size-[18px]"
    />
  )
}

export function LandingNav() {
  const [open, setOpen] = useState(false)
  return (
    <Navbar>
      <NavBody>
        <Link href="/" aria-label="Tegata, home" className="relative z-20 px-1">
          <Lockup size={30} />
        </Link>
        <NavItems items={ITEMS} />
        <div className="relative z-20 flex items-center gap-1.5">
          <ThemeSwitch />
          <Link href="/signin" className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Sign in
          </Link>
          <Link
            href="/signin"
            onClick={() => fire("press", { cue: "tap" })}
            className={cn(buttonVariants({ size: "sm" }), "rounded-full px-5")}
          >
            Open an account
          </Link>
        </div>
      </NavBody>

      <MobileNav>
        <MobileNavHeader>
          <Link href="/" aria-label="Tegata, home">
            <Lockup size={28} />
          </Link>
          <div className="flex items-center gap-1">
            <ThemeSwitch />
            <MobileNavToggle isOpen={open} onClick={() => setOpen(!open)} />
          </div>
        </MobileNavHeader>
        <MobileNavMenu isOpen={open} onClose={() => setOpen(false)}>
          {ITEMS.map((item) => (
            <a
              key={item.link}
              href={item.link}
              onClick={() => setOpen(false)}
              className="w-full rounded-[12px] px-3 py-3 text-[17px] font-semibold hover:bg-secondary"
            >
              {item.name}
            </a>
          ))}
          <div className="mt-2 grid w-full grid-cols-2 gap-2">
            <Link href="/signin" className={buttonVariants({ variant: "secondary", size: "md" })}>
              Sign in
            </Link>
            <Link href="/signin" className={buttonVariants({ size: "md" })}>
              Open an account
            </Link>
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  )
}
