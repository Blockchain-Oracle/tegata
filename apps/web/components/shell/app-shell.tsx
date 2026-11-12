"use client"

// The app shell (plan 6.7; Senryo's floating rail and Kawase's dock, 21st unlumen/sidebar-001 21517 and soralabs/
// dock-nav 19177): a floating rail on desktop with a springing active pill, a bottom dock on a phone, the mode
// capsule, ⌘K and the account. Places appear here as their stages land, so nothing in the rail is a dead end.
import {
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  Command as CommandIcon,
  FileText,
  Gift,
  Home,
  Link2,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  Users,
} from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { DropdownMenu } from "radix-ui"
import { useState } from "react"
import { BusinessSeal, Lockup, TegataSeal } from "@/components/brand/seal"
import { fire } from "@/lib/feedback"
import { LINKS } from "@/lib/links"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

import { CommandMenu } from "./command-menu"
import { ModeCapsule } from "./mode-capsule"
import { ReceiveSheet } from "./receive-sheet"
import { ShellContext } from "./shell-context"

type Place =
  | { kind: "link"; href: string; label: string; icon: React.ReactNode }
  | { kind: "action"; id: "receive"; label: string; icon: React.ReactNode }

const PLACES: Place[] = [
  { kind: "link", href: "/app", label: "Home", icon: <Home /> },
  { kind: "action", id: "receive", label: "Get paid", icon: <ArrowDownLeft /> },
  { kind: "link", href: "/app/invoices", label: "Invoices", icon: <FileText /> },
  { kind: "link", href: "/app/links", label: "Pay links", icon: <Link2 /> },
  { kind: "link", href: "/app/customers", label: "Customers", icon: <Users /> },
  { kind: "link", href: "/app/send", label: "Send", icon: <ArrowUpRight /> },
  { kind: "link", href: "/app/refer", label: "Refer", icon: <Gift /> },
]

const PILL = { type: "spring", stiffness: 500, damping: 36 } as const

export function AppShell({
  children,
  businessName,
  handle,
  accountId,
  live,
  liveAvailable,
  onSignOut,
}: {
  children: React.ReactNode
  businessName: string
  handle: string
  accountId: string
  live: boolean
  liveAvailable: boolean
  onSignOut: () => void
}) {
  const pathname = usePathname()
  const [receive, setReceive] = useState(false)
  const [command, setCommand] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  const copyAddress = async () => {
    await navigator.clipboard.writeText(accountId)
    fire("tick", { cue: "confirmed" })
  }
  const activeHref = PLACES.filter((p): p is Extract<Place, { kind: "link" }> => p.kind === "link")
    .filter((p) => pathname === p.href || (p.href !== "/app" && pathname.startsWith(p.href)))
    .map((p) => p.href)[0]

  const account = (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="press flex w-full items-center gap-3 rounded-[16px] p-2 text-left hover:bg-secondary"
          aria-label="Account"
        >
          <BusinessSeal name={businessName} size={40} tilt={0} />
          <span className="flex min-w-0 flex-col max-xl:hidden">
            <span className="truncate text-[15px] font-semibold">{businessName}</span>
            <span className="truncate font-mono text-meta text-muted-foreground">{handle}</span>
          </span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="top"
          align="start"
          sideOffset={8}
          className="z-50 min-w-56 rounded-[16px] bg-popover p-1.5 shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Item asChild>
            <Link
              href="/app/settings"
              className="flex h-11 cursor-pointer items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium outline-none data-[highlighted]:bg-secondary"
            >
              <Settings className="size-4" /> Business profile
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item asChild>
            <a
              href={LINKS.docs}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 cursor-pointer items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium outline-none data-[highlighted]:bg-secondary"
            >
              <BookOpen className="size-4" /> Docs
            </a>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
            className="flex h-11 cursor-pointer items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium outline-none data-[highlighted]:bg-secondary"
          >
            {resolvedTheme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
            {resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onSignOut}
            className="flex h-11 cursor-pointer items-center gap-3 rounded-[10px] px-3 text-[15px] font-medium outline-none data-[highlighted]:bg-secondary"
          >
            <LogOut className="size-4" /> Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )

  return (
    <ShellContext.Provider
      value={{ openReceive: () => setReceive(true), openCommand: () => setCommand(true) }}
    >
      <div className="min-h-dvh bg-background lg:flex lg:gap-4 lg:p-4">
        {/* Desktop rail */}
        <aside className="sticky top-4 hidden h-[calc(100dvh-32px)] w-[88px] shrink-0 flex-col gap-4 rounded-[24px] bg-card p-3 shadow-float lg:flex xl:w-[248px] xl:p-4">
          <div className="flex flex-col gap-3 px-1 pt-1">
            <Link href="/app" aria-label="Tegata home" className="max-xl:mx-auto">
              <span className="max-xl:hidden">
                <Lockup size={34} />
              </span>
              <span className="xl:hidden">
                <TegataSeal size={40} />
              </span>
            </Link>
            <ModeCapsule
              live={live}
              liveAvailable={liveAvailable}
              rail
              className="max-xl:mx-auto"
            />
          </div>
          <button
            type="button"
            onClick={() => setCommand(true)}
            className="press flex h-11 items-center gap-2.5 rounded-[12px] bg-secondary px-3 text-[15px] text-muted-foreground hover:bg-plate-pressed max-xl:justify-center"
          >
            <Search className="size-4 shrink-0" />
            <span className="flex-1 text-left max-xl:hidden">Search</span>
            <kbd className="inline-flex items-center gap-0.5 rounded-[6px] bg-card px-1.5 py-0.5 font-mono text-meta max-xl:hidden">
              <CommandIcon className="size-3" />K
            </kbd>
          </button>
          <nav className="flex flex-col gap-1" aria-label="Places">
            {PLACES.map((place) => {
              const active = place.kind === "link" && place.href === activeHref
              const inner = (
                <>
                  {active ? (
                    <motion.span
                      layoutId="rail-pill"
                      transition={PILL}
                      className="absolute inset-0 rounded-[14px] bg-secondary"
                    />
                  ) : null}
                  <span className="relative grid size-6 place-items-center [&_svg]:size-5">
                    {place.icon}
                  </span>
                  <span className="relative max-xl:hidden">{place.label}</span>
                </>
              )
              const cls = cn(
                "press relative flex h-12 items-center gap-3 rounded-[14px] px-3 text-[16px] font-medium transition-colors max-xl:justify-center",
                active
                  ? "font-semibold text-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )
              return place.kind === "link" ? (
                <Link
                  key={place.href}
                  href={place.href}
                  className={cls}
                  aria-current={active ? "page" : undefined}
                  title={place.label}
                >
                  {inner}
                </Link>
              ) : (
                <button
                  key={place.id}
                  type="button"
                  className={cls}
                  onClick={() => setReceive(true)}
                  title={place.label}
                >
                  {inner}
                </button>
              )
            })}
          </nav>
          <div className="flex-1" />
          <Link
            href="/app/settings"
            title="Business"
            aria-current={pathname.startsWith("/app/settings") ? "page" : undefined}
            className={cn(
              "press flex h-12 items-center gap-3 rounded-[14px] px-3 text-[16px] font-medium transition-colors max-xl:justify-center",
              pathname.startsWith("/app/settings")
                ? "bg-secondary font-semibold text-foreground"
                : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            )}
          >
            <Settings className="size-5" />
            <span className="max-xl:hidden">Business</span>
          </Link>
          {account}
        </aside>

        {/* Phone top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between bg-background/85 px-4 backdrop-blur-md lg:hidden">
          <Link href="/app" aria-label="Tegata home">
            <Lockup size={30} />
          </Link>
          <div className="flex items-center gap-2">
            <ModeCapsule live={live} liveAvailable={liveAvailable} />
            <div className="w-12">{account}</div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1080px] flex-1 px-4 pt-2 pb-32 sm:px-6 lg:px-8 lg:pt-6 lg:pb-12">
          {children}
        </main>

        {/* Phone dock */}
        <nav
          aria-label="Places"
          className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-6 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden"
        >
          <div className="flex h-[60px] items-center gap-1 rounded-[40px] bg-card px-2 shadow-float">
            <DockLink href="/app" label="Home" icon={<Home />} active={activeHref === "/app"} />
            <DockLink
              href="/app/invoices"
              label="Invoices"
              icon={<FileText />}
              active={activeHref === "/app/invoices"}
            />
            <DropdownMenu.Root
              onOpenChange={(open) => fire("tick", { cue: open ? "sheetOpen" : "sheetClose" })}
            >
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label="Create"
                  className="press grid size-12 place-items-center rounded-full bg-shu text-white shadow-object [&_svg]:size-6 [&_svg]:stroke-[2.4] data-[state=open]:[&_svg]:rotate-45 [&_svg]:transition-transform"
                >
                  <Plus />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="top"
                  align="center"
                  sideOffset={14}
                  className="z-50 grid w-[min(340px,calc(100vw-32px))] grid-cols-2 gap-2 rounded-[24px] bg-popover p-2 shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-2"
                >
                  {[
                    {
                      href: "/app/invoices/new",
                      label: "New invoice",
                      icon: <FileText />,
                      field: "bg-matcha",
                    },
                    {
                      href: "/app/links?new=1",
                      label: "New pay link",
                      icon: <Link2 />,
                      field: "bg-sora",
                    },
                    { href: "/app/send", label: "Send", icon: <ArrowUpRight />, field: "bg-kin" },
                  ].map((item) => (
                    <DropdownMenu.Item key={item.href} asChild>
                      <Link
                        href={item.href}
                        className={cn(
                          "flex h-24 flex-col justify-between rounded-[18px] p-3 text-[15px] font-semibold text-black outline-none data-[highlighted]:brightness-95 [&_svg]:size-5",
                          item.field,
                        )}
                      >
                        {item.icon}
                        {item.label}
                      </Link>
                    </DropdownMenu.Item>
                  ))}
                  <DropdownMenu.Item
                    onSelect={() => setReceive(true)}
                    className="flex h-24 cursor-pointer flex-col justify-between rounded-[18px] bg-sakura p-3 text-[15px] font-semibold text-black outline-none data-[highlighted]:brightness-95 [&_svg]:size-5"
                  >
                    <ArrowDownLeft />
                    Get paid (QR)
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            <DockLink
              href="/app/links"
              label="Pay links"
              icon={<Link2 />}
              active={activeHref === "/app/links"}
            />
            <button
              type="button"
              aria-label="Search"
              onClick={() => setCommand(true)}
              className="press relative grid h-11 w-[52px] place-items-center text-text-3 [&_svg]:size-6"
            >
              <Search />
            </button>
          </div>
        </nav>
      </div>

      <ReceiveSheet
        open={receive}
        onOpenChange={setReceive}
        accountId={accountId}
        businessName={businessName}
        sandbox={!live}
      />
      <CommandMenu
        open={command}
        onOpenChange={setCommand}
        onReceive={() => setReceive(true)}
        onCopyAddress={copyAddress}
        onSignOut={onSignOut}
      />
    </ShellContext.Provider>
  )
}

function DockLink({
  href,
  label,
  icon,
  active,
}: {
  href: string
  label: string
  icon: React.ReactNode
  active: boolean
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className="press relative grid h-11 w-[52px] place-items-center"
    >
      {active ? (
        <motion.span
          layoutId="dock-bubble"
          transition={{ type: "spring", stiffness: 420, damping: 30 }}
          className="absolute inset-0 rounded-[24px] bg-secondary"
        />
      ) : null}
      <span
        className={cn(
          "relative [&_svg]:size-6",
          active ? "text-foreground [&_svg]:stroke-[2.4]" : "text-text-3",
        )}
      >
        {icon}
      </span>
    </Link>
  )
}
