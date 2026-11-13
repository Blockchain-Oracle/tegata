"use client"

// The app shell (plan 6.7; Senryo's floating rail and Kawase's dock, 21st unlumen/sidebar-001 21517 and soralabs/
// dock-nav 19177): a floating rail on desktop with a springing active pill, a bottom dock on a phone, the mode
// capsule, ⌘K and the account. Places sit in groups by job with the rarely used ones at the foot (plan 6.7, re-spec
// 2026-11-13); on a phone the dock's Menu opens every place, so each has a visible way in.
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Code2,
  Command as CommandIcon,
  FileText,
  Gift,
  Home,
  Landmark,
  LayoutGrid,
  Link2,
  ListOrdered,
  LogOut,
  Moon,
  Plus,
  ScanLine,
  Search,
  Settings,
  Store,
  Sun,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react"
import { motion } from "motion/react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { DropdownMenu } from "radix-ui"
import { useCallback, useEffect, useRef, useState } from "react"
import { BusinessSeal, Lockup, TegataSeal } from "@/components/brand/seal"
import { Scanner } from "@/components/scan/scanner"
import { fire } from "@/lib/feedback"
import { LINKS } from "@/lib/links"
import { useTheme } from "@/lib/theme"
import { cn } from "@/lib/utils"

import { CommandMenu } from "./command-menu"
import { ModeCapsule } from "./mode-capsule"
import { ReceiveSheet } from "./receive-sheet"
import { Sheet } from "./sheet"
import { ShellContext } from "./shell-context"

interface Place {
  href: string
  label: string
  icon: React.ReactNode
}

const HOME: Place = { href: "/app", label: "Home", icon: <Home /> }
/** The rail's groups by job (plan 6.7, re-spec 2026-11-13). */
const GROUPS: { id: string; label: string; places: Place[] }[] = [
  {
    id: "get-paid",
    label: "Get paid",
    places: [
      { href: "/app/invoices", label: "Invoices", icon: <FileText /> },
      { href: "/app/links", label: "Pay links", icon: <Link2 /> },
      { href: "/app/counter", label: "Counter", icon: <Store /> },
      { href: "/app/customers", label: "Customers", icon: <Users /> },
    ],
  },
  {
    id: "pay",
    label: "Pay people",
    places: [
      { href: "/app/send", label: "Send", icon: <ArrowUpRight /> },
      { href: "/app/people", label: "People", icon: <UsersRound /> },
      { href: "/app/payroll", label: "Payroll", icon: <Banknote /> },
    ],
  },
  {
    id: "money",
    label: "Money",
    places: [
      { href: "/app/activity", label: "Activity", icon: <ListOrdered /> },
      { href: "/app/balance", label: "Balance", icon: <Wallet /> },
      { href: "/app/bank", label: "Bank", icon: <Landmark /> },
    ],
  },
]
/** At the foot: used now and then. */
const FOOT: Place[] = [
  { href: "/app/refer", label: "Refer", icon: <Gift /> },
  { href: "/app/developers", label: "Developers", icon: <Code2 /> },
  { href: "/app/settings", label: "Business", icon: <Settings /> },
]
const ALL = [HOME, ...GROUPS.flatMap((g) => g.places), ...FOOT]
const FOLDED_KEY = "tegata.rail.folded"

/** Folded groups, remembered on this device. */
function useFolded() {
  const [folded, setFolded] = useState<string[]>([])
  useEffect(() => {
    try {
      setFolded(JSON.parse(localStorage.getItem(FOLDED_KEY) ?? "[]") as string[])
    } catch {
      // Storage blocked or bad: everything open.
    }
  }, [])
  const toggle = (id: string) =>
    setFolded((now) => {
      const next = now.includes(id) ? now.filter((x) => x !== id) : [...now, id]
      try {
        localStorage.setItem(FOLDED_KEY, JSON.stringify(next))
      } catch {
        // Not remembered this time.
      }
      return next
    })
  return { folded, toggle }
}

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
  const router = useRouter()
  const [receive, setReceive] = useState(false)
  const [command, setCommand] = useState(false)
  const [scan, setScan] = useState(false)
  const { resolvedTheme, setTheme } = useTheme()

  const copyAddress = async () => {
    await navigator.clipboard.writeText(accountId)
    fire("tick", { cue: "confirmed" })
  }
  const activeHref = ALL.filter(
    (p) => pathname === p.href || (p.href !== "/app" && pathname.startsWith(p.href)),
  ).map((p) => p.href)[0]
  const { folded, toggle } = useFolded()
  const [menu, setMenu] = useState(false)
  const navRef = useRef<HTMLElement>(null)
  const [moreBelow, setMoreBelow] = useState(false)
  const measureNav = useCallback(() => {
    const nav = navRef.current
    if (nav) setMoreBelow(nav.scrollTop + nav.clientHeight < nav.scrollHeight - 4)
  }, [])
  // biome-ignore lint/correctness/useExhaustiveDependencies: folding a group changes the list's height without resizing the box the observer watches, so measure again then.
  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    measureNav()
    const observer = new ResizeObserver(measureNav)
    observer.observe(nav)
    return () => observer.disconnect()
  }, [measureNav, folded])

  const railLink = (place: Place) => {
    const active = place.href === activeHref
    return (
      <Link
        key={place.href}
        href={place.href}
        aria-current={active ? "page" : undefined}
        title={place.label}
        className={cn(
          "press relative flex shrink-0 items-center gap-3 rounded-[14px] px-3 font-medium transition-colors max-xl:justify-center",
          "h-10 text-[15px]",
          active
            ? "font-semibold text-foreground"
            : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
        )}
      >
        {active ? (
          <motion.span
            layoutId="rail-pill"
            transition={PILL}
            className="absolute inset-0 rounded-[14px] bg-secondary"
          />
        ) : null}
        <span className="relative grid size-6 place-items-center [&_svg]:size-5">{place.icon}</span>
        <span className="relative max-xl:hidden">{place.label}</span>
      </Link>
    )
  }

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
      value={{
        openReceive: () => setReceive(true),
        openCommand: () => setCommand(true),
        openScan: () => setScan(true),
      }}
    >
      <div className="min-h-dvh bg-background lg:flex lg:gap-4 lg:p-4">
        {/* Desktop rail */}
        <aside className="sticky top-4 hidden h-[calc(100dvh-32px)] w-[88px] shrink-0 flex-col gap-3 rounded-[24px] bg-card p-3 shadow-float lg:flex xl:w-[248px] xl:p-4">
          {/* The seal and the Sandbox/Live switch share a row on a wide rail, stack on the icon rail. */}
          <div className="flex flex-col gap-3 px-1 pt-1 xl:flex-row xl:items-center xl:gap-2.5">
            <Link href="/app" aria-label="Tegata home" className="shrink-0 max-xl:mx-auto">
              <TegataSeal size={38} />
            </Link>
            <ModeCapsule
              live={live}
              liveAvailable={liveAvailable}
              rail
              className="max-xl:mx-auto xl:flex-1"
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
          <button
            type="button"
            onClick={() => setScan(true)}
            className="press flex h-11 items-center gap-2.5 rounded-[12px] bg-secondary px-3 text-[15px] text-muted-foreground hover:bg-plate-pressed max-xl:justify-center"
          >
            <ScanLine className="size-4 shrink-0" />
            <span className="flex-1 text-left max-xl:hidden">Scan a QR code</span>
          </button>
          <nav
            ref={navRef}
            onScroll={measureNav}
            className={cn(
              "-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1 [scrollbar-width:none]",
              // More below on a short window: fade the last rows out so the list reads as one that scrolls.
              moreBelow &&
                "[mask-image:linear-gradient(to_bottom,black_calc(100%-40px),transparent)]",
            )}
            aria-label="Places"
          >
            {railLink(HOME)}
            {GROUPS.map((group) => {
              const holdsActive = group.places.some((p) => p.href === activeHref)
              const open = holdsActive || !folded.includes(group.id)
              return (
                <div key={group.id} className="flex flex-col gap-0.5 pt-1.5">
                  <button
                    type="button"
                    onClick={() => (holdsActive ? undefined : toggle(group.id))}
                    aria-expanded={open}
                    className="group flex h-6 shrink-0 items-center gap-1 px-3 text-[13px] font-semibold text-text-3 hover:text-foreground max-xl:hidden"
                  >
                    {group.label}
                    {open ? (
                      <ChevronDown className="size-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                    ) : (
                      <ChevronRight className="size-3.5" />
                    )}
                  </button>
                  <span className="mx-auto my-1 h-px w-8 bg-border xl:hidden" aria-hidden />
                  {open ? group.places.map((place) => railLink(place)) : null}
                </div>
              )
            })}
          </nav>
          {/* Used now and then: one row of three labelled tiles on a wide rail, a short column on the icon rail. */}
          <div className="flex shrink-0 flex-col gap-0.5 border-t border-border pt-2 xl:flex-row xl:gap-1">
            {FOOT.map((place) => {
              const active = place.href === activeHref
              return (
                <Link
                  key={place.href}
                  href={place.href}
                  title={place.label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "press flex h-10 items-center justify-center rounded-[12px] transition-colors xl:h-14 xl:flex-1 xl:flex-col xl:gap-1",
                    active
                      ? "bg-secondary font-semibold text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
                  )}
                >
                  <span className="grid place-items-center [&_svg]:size-5 xl:[&_svg]:size-[18px]">
                    {place.icon}
                  </span>
                  <span className="text-[12px] font-medium max-xl:hidden">{place.label}</span>
                </Link>
              )
            })}
          </div>
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
                    {
                      href: "/app/payroll",
                      label: "Run payroll",
                      icon: <Banknote />,
                      field: "bg-matcha",
                    },
                    {
                      href: "/app/counter",
                      label: "Counter",
                      icon: <Store />,
                      field: "bg-kin",
                    },
                    {
                      href: "/app/people",
                      label: "Add people",
                      icon: <UsersRound />,
                      field: "bg-sora",
                    },
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
                    onSelect={() => setScan(true)}
                    className="flex h-24 cursor-pointer flex-col justify-between rounded-[18px] bg-ai p-3 text-[15px] font-semibold text-white outline-none data-[highlighted]:brightness-110 [&_svg]:size-5"
                  >
                    <ScanLine />
                    Scan to pay
                  </DropdownMenu.Item>
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
              aria-label="Menu: every place"
              onClick={() => setMenu(true)}
              className="press relative grid h-11 w-[52px] place-items-center text-text-3 [&_svg]:size-6"
            >
              <LayoutGrid />
            </button>
          </div>
        </nav>
      </div>

      <Sheet open={menu} onOpenChange={setMenu} title="Everything">
        <div className="flex flex-col gap-5 px-4 pb-6">
          <button
            type="button"
            onClick={() => {
              setMenu(false)
              setCommand(true)
            }}
            className="press flex h-12 items-center gap-3 rounded-[14px] bg-secondary px-4 text-[16px] text-muted-foreground"
          >
            <Search className="size-5" /> Search
          </button>
          {[
            { id: "home", label: null, places: [HOME] },
            ...GROUPS,
            { id: "foot", label: "More", places: FOOT },
          ].map((group) => (
            <section key={group.id} className="flex flex-col gap-1">
              {group.label ? (
                <h3 className="px-1 text-[13px] font-semibold text-text-3">{group.label}</h3>
              ) : null}
              {group.places.map((place) => (
                <Link
                  key={place.href}
                  href={place.href}
                  onClick={() => setMenu(false)}
                  aria-current={place.href === activeHref ? "page" : undefined}
                  className={cn(
                    "press flex h-12 items-center gap-3 rounded-[14px] px-3 text-[16px] font-medium",
                    place.href === activeHref
                      ? "bg-secondary font-semibold"
                      : "hover:bg-secondary/60",
                  )}
                >
                  <span className="grid size-8 place-items-center rounded-full bg-card [&_svg]:size-[18px]">
                    {place.icon}
                  </span>
                  {place.label}
                </Link>
              ))}
            </section>
          ))}
        </div>
      </Sheet>
      <ReceiveSheet
        open={receive}
        onOpenChange={setReceive}
        accountId={accountId}
        businessName={businessName}
        sandbox={!live}
      />
      <Sheet open={scan} onOpenChange={setScan} title="Scan a QR code">
        <Scanner
          active={scan}
          onGo={(href) => {
            setScan(false)
            router.push(href)
          }}
        />
      </Sheet>
      <CommandMenu
        open={command}
        onOpenChange={setCommand}
        onReceive={() => setReceive(true)}
        onScan={() => setScan(true)}
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
