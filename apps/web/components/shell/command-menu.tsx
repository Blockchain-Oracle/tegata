"use client"

// ⌘K (21st 27378 on cmdk): every action and every place, typed. Opens with ⌘K / Ctrl K or the rail's search row.
import { Command } from "cmdk"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Copy,
  FileText,
  Gift,
  Home,
  Link2,
  LogOut,
  Moon,
  Palette,
  Plus,
  Settings,
  Sun,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { Dialog } from "radix-ui"
import { useEffect } from "react"
import { fire } from "@/lib/feedback"
import { useTheme } from "@/lib/theme"

export function CommandMenu({
  open,
  onOpenChange,
  onReceive,
  onCopyAddress,
  onSignOut,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReceive: () => void
  onCopyAddress: () => void
  onSignOut: () => void
}) {
  const router = useRouter()
  const { resolvedTheme, setTheme } = useTheme()

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
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed top-[14vh] left-1/2 z-50 w-[min(560px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-[20px] bg-popover shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
        >
          <Dialog.Title className="sr-only">Command menu</Dialog.Title>
          <Command label="Command menu" className="flex flex-col">
            <Command.Input
              autoFocus
              placeholder="Type a command or search…"
              className="h-14 w-full border-b border-secondary bg-transparent px-5 text-[17px] outline-none placeholder:text-text-3"
            />
            <Command.List className="max-h-[50vh] overflow-y-auto p-2">
              <Command.Empty className="px-3 py-8 text-center text-[15px] text-muted-foreground">
                Nothing matches.
              </Command.Empty>
              <Group heading="Money">
                <Item icon={<ArrowDownLeft />} onSelect={run(onReceive)}>
                  Get paid
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
                <Item icon={<Gift />} onSelect={run(() => router.push("/app/refer"))}>
                  Refer a business
                </Item>
                <Item icon={<Settings />} onSelect={run(() => router.push("/app/settings"))}>
                  Business profile
                </Item>
                <Item icon={<Palette />} onSelect={run(() => router.push("/dev"))}>
                  Design review
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
}: {
  icon: React.ReactNode
  onSelect: () => void
  children: React.ReactNode
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className="flex h-12 cursor-pointer items-center gap-3 rounded-[12px] px-3 text-[16px] font-medium data-[selected=true]:bg-secondary [&_svg]:size-[18px] [&_svg]:text-muted-foreground"
    >
      {icon}
      {children}
    </Command.Item>
  )
}
