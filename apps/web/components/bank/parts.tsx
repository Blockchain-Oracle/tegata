"use client"

// Bank parts: a round flag for a country or currency, a monogram disc for a bank (no logo set covers
// Nigeria's 571 banks), and a line of bank details you tap to copy.
import { Check, Copy } from "lucide-react"
import { useState } from "react"

import { BANK_LOGOS } from "@/lib/bank-logos"
import { fire } from "@/lib/feedback"
import { FIAT_FLAG } from "@/lib/fiat"
import { cn } from "@/lib/utils"

/** A round flag: a country code ("ng") or a currency ("NGN"). */
export function Flag({
  code,
  size = 24,
  className,
  label,
}: {
  code: string
  size?: number
  className?: string
  label?: string
}) {
  const file = (FIAT_FLAG[code.toUpperCase()] ?? code).toLowerCase()
  return (
    <img
      src={`/flags/${file}.svg`}
      alt={label ?? ""}
      width={size}
      height={size}
      draggable={false}
      className={cn("shrink-0 rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.06)]", className)}
      style={{ width: size, height: size }}
    />
  )
}

const DISC = [
  "bg-matcha text-black",
  "bg-sora text-black",
  "bg-sakura text-black",
  "bg-kin text-black",
  "bg-ai text-white",
  "bg-shu text-white",
] as const
const GENERIC = new Set(["the", "plc", "ltd", "limited", "of", "and", "nigeria", "ghana", "pty"])

const LOGO_BY_NAME = new Map(Object.entries(BANK_LOGOS).map(([k, v]) => [k.toLowerCase(), v]))

/** The bank's logo when Tegata has it (public/banks); none has a logo set for every bank. */
export const bankLogo = (name: string) => LOGO_BY_NAME.get(name.toLowerCase()) ?? null

/**
 * The bank's real logo on a white disc; for a bank without one, initials on a colour picked from its name so the same
 * bank always looks the same.
 */
export function BankDisc({
  name,
  size = 40,
  className,
}: {
  name: string
  size?: number
  className?: string
}) {
  const logo = bankLogo(name)
  if (logo)
    return (
      <img
        src={logo}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className={cn(
          "shrink-0 rounded-full bg-white object-cover shadow-[0_0_0_1px_rgba(0,0,0,0.08)]",
          className,
        )}
        style={{ width: size, height: size }}
      />
    )
  const words = name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter((w) => w && !GENERIC.has(w.toLowerCase()))
  const first = words[0] ?? name
  // "Access Bank" → AB, "Zenith bank PLC" → ZB, "Moniepoint" → M.
  const initials = (
    words.length > 1 ? `${first[0]}${words[1]?.[0] ?? ""}` : (first[0] ?? "")
  ).toUpperCase()
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full font-bold tracking-tight",
        DISC[hash % DISC.length],
        className,
      )}
      style={{ width: size, height: size, fontSize: Math.round(size * 0.36) }}
    >
      {initials}
    </span>
  )
}

/** One line of bank details: the label small, the value large; tapping copies the value. */
export function CopyLine({
  label,
  value,
  shown,
  mono = true,
}: {
  label: string
  value: string
  /** How the value is drawn (grouped), when it differs from what's copied. */
  shown?: string
  mono?: boolean
}) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value)
        fire("tick", { cue: "confirmed" })
        setCopied(true)
        setTimeout(() => setCopied(false), 1400)
      }}
      className="press group flex w-full items-center gap-3 py-3 text-left"
      aria-label={`Copy ${label}`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[13px] font-medium text-[#6E6E6E]">{label}</span>
        <span
          className={cn(
            "break-words text-[17px] font-semibold text-black",
            mono && "font-mono tracking-[0.02em]",
          )}
        >
          {shown ?? value}
        </span>
      </span>
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full bg-[#F1F1F1] text-black transition-colors group-hover:bg-[#E6E6E6] [&_svg]:size-4",
          copied && "bg-matcha",
        )}
      >
        {copied ? <Check /> : <Copy />}
      </span>
    </button>
  )
}
