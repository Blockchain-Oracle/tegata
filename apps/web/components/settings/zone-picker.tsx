"use client"

// The time-zone picker (plan 6.8 I, audit S7): a row that says the zone the way people do ("British time (London)"
// and its UTC offset), opening a sheet with a search across every zone, sorted by offset.
import { Check, ChevronDown, Clock3, Search } from "lucide-react"
import { useMemo, useState } from "react"

import { Field } from "@/components/kit/field"
import { Sheet } from "@/components/shell/sheet"
import { cn } from "@/lib/utils"
import { zoneLabel } from "@/lib/zone"

/** "UTC+1", "UTC−3:30", "UTC" for a zone right now. */
export function zoneOffset(timeZone: string): string {
  try {
    const name =
      new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "shortOffset" })
        .formatToParts(new Date())
        .find((part) => part.type === "timeZoneName")?.value ?? ""
    const offset = name.replace(/^GMT/, "")
    if (!offset || /^[+-]0(:00)?$/.test(offset)) return "UTC"
    return `UTC${offset.replace("-", "−")}`
  } catch {
    return ""
  }
}

/** Minutes east of UTC from "UTC+5:30" / "UTC−3", for sorting. */
function minutes(offset: string): number {
  const match = /([+−])(\d+)(?::(\d+))?/.exec(offset)
  if (!match) return 0
  const value = Number(match[2]) * 60 + Number(match[3] ?? 0)
  return match[1] === "−" ? -value : value
}

interface Zone {
  id: string
  label: string
  offset: string
  minutes: number
}

function allZones(current: string): Zone[] {
  let ids: string[]
  try {
    ids = Intl.supportedValuesOf("timeZone")
  } catch {
    ids = ["UTC"]
  }
  if (!ids.includes(current)) ids = [current, ...ids]
  return ids
    .map((id) => {
      const offset = zoneOffset(id)
      return { id, label: zoneLabel(id), offset, minutes: minutes(offset) }
    })
    .sort((a, b) => a.minutes - b.minutes || a.label.localeCompare(b.label))
}

export function ZonePicker({
  id,
  value,
  onChange,
}: {
  id?: string
  value: string
  onChange: (zone: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  // Naming ~400 zones takes a moment, so it waits for the first open.
  const zones = useMemo(() => (open ? allZones(value) : []), [open, value])
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase().replace(/_/g, " ")
    if (!q) return zones
    return zones.filter(
      (z) =>
        z.label.toLowerCase().includes(q) ||
        z.id.toLowerCase().replace(/_/g, " ").includes(q) ||
        z.offset.toLowerCase().replace("−", "-").includes(q.replace("−", "-")),
    )
  }, [zones, query])

  return (
    <>
      <button
        id={id}
        type="button"
        onClick={() => setOpen(true)}
        className="press flex h-14 w-full items-center gap-3 rounded-[14px] bg-input px-4 text-left outline-none focus-visible:shadow-[0_0_0_2px_var(--shu)]"
      >
        <Clock3 className="size-[18px] shrink-0 text-text-3" />
        <span className="min-w-0 flex-1 truncate text-[17px] font-medium">{zoneLabel(value)}</span>
        <span className="tnum shrink-0 text-[15px] text-muted-foreground">{zoneOffset(value)}</span>
        <ChevronDown className="size-4 shrink-0 text-text-3" />
      </button>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setQuery("")
        }}
        title="Time zone"
      >
        <div className="flex flex-col gap-3">
          <Field
            id="zone-search"
            aria-label="Search time zones"
            placeholder="City, country or UTC+1"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            leading={<Search className="size-[18px] shrink-0 text-text-3" />}
            autoComplete="off"
            spellCheck={false}
          />
          <ul className="flex flex-col">
            {shown.map((zone) => {
              const on = zone.id === value
              return (
                <li key={zone.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => {
                      onChange(zone.id)
                      setOpen(false)
                      setQuery("")
                    }}
                    className={cn(
                      "press flex min-h-12 w-full items-center gap-3 rounded-[12px] px-3 py-2 text-left",
                      on ? "bg-shu-wash" : "hover:bg-secondary",
                    )}
                  >
                    <span className="min-w-0 flex-1 text-[15px] font-medium">{zone.label}</span>
                    <span className="tnum shrink-0 text-detail text-muted-foreground">
                      {zone.offset}
                    </span>
                    <span className="grid size-4 shrink-0 place-items-center">
                      {on ? <Check className="size-4 text-shu-ink" strokeWidth={2.6} /> : null}
                    </span>
                  </button>
                </li>
              )
            })}
            {zones.length > 0 && shown.length === 0 ? (
              <li className="flex items-center justify-center gap-1.5 px-3 py-6 text-[15px] text-muted-foreground">
                No zone matches “{query.trim()}”.
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="font-semibold text-shu-ink hover:underline"
                >
                  Show all
                </button>
              </li>
            ) : null}
          </ul>
        </div>
      </Sheet>
    </>
  )
}
