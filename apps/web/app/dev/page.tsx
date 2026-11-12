import { ArrowUpRight } from "lucide-react"
import Link from "next/link"

import { TegataSeal } from "@/components/brand/seal"
import { Stage } from "@/components/kit/stage"
import { cn } from "@/lib/utils"

const CARDS = [
  {
    href: "/dev/brand",
    title: "Brand",
    note: "The 手形 seal, wordmark, business seals, the press",
    field: "bg-shu",
  },
  {
    href: "/dev/color",
    title: "Colour & type",
    note: "Plates, the stage, story fields, Archivo",
    field: "bg-kin",
  },
  {
    href: "/dev/kit",
    title: "Kit",
    note: "Buttons, fields, code cells, hold, steps, figures",
    field: "bg-sora",
  },
  {
    href: "/dev/states",
    title: "States",
    note: "Loading, empty, error, waiting",
    field: "bg-matcha",
  },
  {
    href: "/dev/motion",
    title: "Motion & sound",
    note: "Press, roll, stamp, every cue",
    field: "bg-sakura",
  },
  {
    href: "/dev/marks",
    title: "Logos",
    note: "Every chain, coin and partner mark",
    field: "bg-ai text-white",
  },
  {
    href: "/dev/flows/signin",
    title: "Sign-in",
    note: "Story stage, email, the six-cell code, the seal",
    field: "bg-shu",
  },
  {
    href: "/dev/flows/welcome",
    title: "Welcome",
    note: "Name, pay address, opening on NEAR, the stamp",
    field: "bg-kin",
  },
  {
    href: "/dev/flows/home",
    title: "Home & Send",
    note: "Balance stage, activity, hold to send, receipt",
    field: "bg-sora",
  },
  {
    href: "/dev/flows/links",
    title: "Pay links",
    note: "List, new link, the link with its QR and payments",
    field: "bg-matcha",
  },
  {
    href: "/dev/flows/pay",
    title: "Pay page & receipt",
    note: "Three ways to pay, live steps, the paid seal, the slip",
    field: "bg-sakura",
  },
  {
    href: "/dev/flows/invoices",
    title: "Invoices",
    note: "List, builder with live preview, the invoice, what the customer opens",
    field: "bg-matcha",
  },
  {
    href: "/dev/flows/business",
    title: "Business profile",
    note: "The receipt header, the seal that follows the name, every field",
    field: "bg-kin",
  },
] as const

export default function DevIndex() {
  return (
    <div className="flex flex-col gap-6 pt-4">
      <Stage className="min-h-[300px] p-8 sm:p-12">
        <div className="flex h-full flex-col justify-between gap-10 sm:flex-row sm:items-end">
          <div className="flex flex-col gap-3">
            <TegataSeal size={88} tone="paper" tilt={-4} />
            <h1 className="display text-[56px] leading-[0.95] sm:text-[72px]">Design review</h1>
            <p className="max-w-md text-[17px] text-white/85">
              Every part of Tegata, in every state, on the real tokens. Switch theme, Sandbox or
              Live, phone width and sound at the top.
            </p>
          </div>
        </div>
      </Stage>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="press-lift group flex flex-col overflow-hidden rounded-[20px] bg-card"
          >
            <div className={cn("flex h-28 items-end justify-between p-5 text-black", c.field)}>
              <span className="display text-[34px] leading-none">{c.title}</span>
              <ArrowUpRight className="size-6 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
            </div>
            <p className="p-5 text-[15px] text-muted-foreground">{c.note}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
