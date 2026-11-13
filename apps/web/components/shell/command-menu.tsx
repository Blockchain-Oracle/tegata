"use client"

// ⌘K (21st 27378 on cmdk): every action and every place, typed. Opens with ⌘K / Ctrl K or the rail's search row.
import { Command } from "cmdk"

const SEARCH_DEBOUNCE_MS = 200

import { useQuery } from "@tanstack/react-query"
import type { SearchResults } from "@tegata/services"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BookOpen,
  Code2,
  Copy,
  CreditCard,
  FileText,
  Gift,
  Home,
  Landmark,
  Link2,
  ListOrdered,
  LogOut,
  Moon,
  Plus,
  ScanLine,
  Settings,
  ShoppingBag,
  Store,
  Sun,
  Users,
  UsersRound,
  Wallet,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Dialog } from "radix-ui"
import { useEffect, useState } from "react"
import { CustomerDisc } from "@/components/invoices/customer-picker"
import { api } from "@/lib/client/api"
import { fire } from "@/lib/feedback"
import { LINKS } from "@/lib/links"
import { useTheme } from "@/lib/theme"

export function CommandMenu({
  open,
  onOpenChange,
  onReceive,
  onScan,
  onCopyAddress,
  onSignOut,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReceive: () => void
  onScan: () => void
  onCopyAddress: () => void
  onSignOut: () => void
}) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()
  const [query, setQuery] = useState("")
  const [debounced, setDebounced] = useState("")
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])
  useEffect(() => {
    if (!open) setQuery("")
  }, [open])
  // Records, not just commands: invoices (by number or customer), customers, people and pay links.
  const found = useQuery({
    queryKey: ["search", debounced],
    queryFn: () => api<SearchResults>(`/api/search?q=${encodeURIComponent(debounced)}`),
    enabled: open && debounced.length >= 2,
    placeholderData: (previous) => previous,
  })
  const results = debounced.length >= 2 ? found.data : undefined

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        onOpenChange(!open)
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open, onOpenChange])

  useEffect(() => {
    if (open) fire("tick", { cue: "sheetOpen" })
  }, [open])

  const run = (action: () => void) => () => {
    onOpenChange(false)
    action()
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim/70 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[14vh] left-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[20px] bg-popover shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <Dialog.Title className="sr-only">Command menu</Dialog.Title>
          <Command label="Command menu" className="flex flex-col">
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search invoices, customers, people, or type a command…"
              className="h-14 w-full border-b border-secondary bg-transparent px-5 text-[17px] outline-none placeholder:text-text-3"
            />
            <Command.List className="max-h-[50vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-[15px] text-muted-foreground">
                {found.isFetching ? "Searching…" : "Nothing matches."}
              </Command.Empty>
              {results &&
              results.invoices.length +
                results.customers.length +
                results.people.length +
                results.links.length >
                0 ? (
                <Group heading="Found">
                  {results.invoices.map((inv) => (
                    <Item
                      key={inv.id}
                      keywords={[debounced]}
                      icon={<FileText />}
                      onSelect={run(() => router.push(`/app/invoices/${inv.id}`))}
                    >
                      {inv.label}
                      {inv.customer ? (
                        <span className="text-muted-foreground">· {inv.customer}</span>
                      ) : null}
                    </Item>
                  ))}
                  {results.customers.map((c) => (
                    <Item
                      key={c.id}
                      keywords={[debounced]}
                      icon={<CustomerDisc name={c.name} size={28} />}
                      onSelect={run(() => router.push(`/app/customers?id=${c.id}`))}
                    >
                      {c.name} <span className="text-muted-foreground">· customer</span>
                    </Item>
                  ))}
                  {results.people.map((person) => (
                    <Item
                      key={person.id}
                      keywords={[debounced]}
                      icon={<CustomerDisc name={person.name} size={28} />}
                      onSelect={run(() => router.push(`/app/people?id=${person.id}`))}
                    >
                      {person.name}{" "}
                      <span className="text-muted-foreground">
                        · {person.role || "on your team"}
                      </span>
                    </Item>
                  ))}
                  {results.links.map((link) => (
                    <Item
                      key={link.id}
                      keywords={[debounced]}
                      icon={<Link2 />}
                      onSelect={run(() => router.push(`/app/links/${link.id}`))}
                    >
                      {link.title} <span className="text-muted-foreground">· pay link</span>
                    </Item>
                  ))}
                </Group>
              ) : null}
              <Group heading="Money">
                <Item icon={<ArrowDownLeft />} onSelect={run(onReceive)}>
                  Get paid
                </Item>
                <Item icon={<ScanLine />} onSelect={run(onScan)}>
                  Scan a QR code to pay
                </Item>
                <Item icon={<FileText />} onSelect={run(() => router.push("/app/invoices/new"))}>
                  New invoice
                </Item>
                <Item icon={<Plus />} onSelect={run(() => router.push("/app/links?new=1"))}>
                  New pay link
                </Item>
                <Item icon={<ArrowUpRight />} onSelect={run(() => router.push("/app/send"))}>
                  Send dollars
                </Item>
                <Item icon={<Banknote />} onSelect={run(() => router.push("/app/payroll"))}>
                  Run payroll
                </Item>
                <Item icon={<Store />} onSelect={run(() => router.push("/app/counter"))}>
                  Counter: take a payment in person
                </Item>
                <Item icon={<UsersRound />} onSelect={run(() => router.push("/app/people"))}>
                  Add people
                </Item>
                <Item icon={<Copy />} onSelect={run(onCopyAddress)}>
                  Copy my pay address
                </Item>
              </Group>
              <Group heading="Go to">
                <Item icon={<Home />} onSelect={run(() => router.push("/app"))}>
                  Home
                </Item>
                <Item icon={<FileText />} onSelect={run(() => router.push("/app/invoices"))}>
                  Invoices
                </Item>
                <Item icon={<Link2 />} onSelect={run(() => router.push("/app/links"))}>
                  Pay links
                </Item>
                <Item icon={<Users />} onSelect={run(() => router.push("/app/customers"))}>
                  Customers
                </Item>
                <Item icon={<UsersRound />} onSelect={run(() => router.push("/app/people"))}>
                  People
                </Item>
                <Item icon={<Banknote />} onSelect={run(() => router.push("/app/payroll"))}>
                  Payroll
                </Item>
                <Item icon={<ListOrdered />} onSelect={run(() => router.push("/app/activity"))}>
                  Activity
                </Item>
                <Item icon={<Wallet />} onSelect={run(() => router.push("/app/balance"))}>
                  Balance
                </Item>
                <Item icon={<Landmark />} onSelect={run(() => router.push("/app/bank"))}>
                  Withdraw to a bank · bank details
                </Item>
                <Item icon={<ShoppingBag />} onSelect={run(() => router.push("/app/checkout"))}>
                  Checkout: a pay button for your site
                </Item>
                <Item icon={<CreditCard />} onSelect={run(() => router.push("/app/cards"))}>
                  Cards: spend cards for you and your team
                </Item>
                <Item icon={<Gift />} onSelect={run(() => router.push("/app/refer"))}>
                  Refer a business
                </Item>
                <Item icon={<Code2 />} onSelect={run(() => router.push("/app/developers"))}>
                  Developers: API keys and webhooks
                </Item>
                <Item icon={<Settings />} onSelect={run(() => router.push("/app/settings"))}>
                  Business
                </Item>
                <Item icon={<BookOpen />} onSelect={run(() => window.open(LINKS.docs, "_blank"))}>
                  Docs
                </Item>
              </Group>
              <Group heading="You">
                <Item
                  icon={resolvedTheme === "dark" ? <Sun /> : <Moon />}
                  onSelect={run(() => setTheme(resolvedTheme === "dark" ? "light" : "dark"))}
                >
                  {resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
                </Item>
                <Item icon={<LogOut />} onSelect={run(onSignOut)}>
                  Sign out
                </Item>
              </Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function Group({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <Command.Group
      heading={heading}
      className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:pb-1.5 [&_[cmdk-group-heading]]:text-meta [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:text-text-3"
    >
      {children}
    </Command.Group>
  )
}

function Item({
  icon,
  onSelect,
  children,
  keywords,
}: {
  icon: React.ReactNode
  onSelect: () => void
  children: React.ReactNode
  /** Extra words cmdk matches on (search results always match the query that found them). */
  keywords?: string[]
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      keywords={keywords}
      className="flex h-12 cursor-pointer items-center gap-3 rounded-[12px] px-3 text-[16px] font-medium data-[selected=true]:bg-secondary [&_svg]:size-[18px] [&_svg]:text-muted-foreground"
    >
      {icon}
      {children}
    </Command.Item>
  )
}
