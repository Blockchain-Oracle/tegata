"use client"

// A designed date picker: a field-shaped button that reads the date
// as people say it ("12 Nov 2026"), and a month grid in a popover. The chosen day is vermilion, today is ringed, and
// days before `min` are off. Dates are plain `YYYY-MM-DD` strings, as the invoice keeps them.
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react"
import { Popover } from "radix-ui"
import { useState } from "react"

import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"] as const

const pad = (n: number) => String(n).padStart(2, "0")
/** `month` is 0-based, as in Date. */
const isoOf = (year: number, month: number, day: number) => `${year}-${pad(month + 1)}-${pad(day)}`

function parts(value: string) {
  const [year = 1970, month = 1] = value.split("-").map(Number)
  return { year, month: month - 1 }
}

function localToday() {
  const now = new Date()
  return isoOf(now.getFullYear(), now.getMonth(), now.getDate())
}

/** "12 Nov 2026". */
export const dateText = (value: string) =>
  new Date(`${value}T12:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  })

export function DatePicker({
  id,
  label,
  value,
  onChange,
  min,
  open: openProp,
  onOpenChange,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  /** The earliest day that can be picked. */
  min?: string
  /** Controlled, so another control (a "Date" chip) can open it. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [ownOpen, setOwnOpen] = useState(false)
  const open = openProp ?? ownOpen
  const [view, setView] = useState(() => parts(value))
  const setOpen = (next: boolean) => {
    if (next) setView(parts(value))
    setOwnOpen(next)
    onOpenChange?.(next)
  }
  const today = localToday()
  const first = (new Date(Date.UTC(view.year, view.month, 1)).getUTCDay() + 6) % 7
  const days = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate()
  const monthLabel = new Date(Date.UTC(view.year, view.month, 1)).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  })
  const step = (by: number) => {
    fire("tick")
    setView((v) => {
      const month = v.month + by
      return { year: v.year + Math.floor(month / 12), month: ((month % 12) + 12) % 12 }
    })
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-detail font-medium text-muted-foreground">
        {label}
      </label>
      <Popover.Root open={open} onOpenChange={setOpen}>
        <Popover.Trigger asChild>
          <button
            id={id}
            type="button"
            className="press flex h-14 w-full items-center gap-3 rounded-[14px] bg-input px-4 text-left outline-none focus-visible:shadow-[0_0_0_2px_var(--shu)] data-[state=open]:bg-card data-[state=open]:shadow-[0_0_0_2px_var(--shu)]"
          >
            <CalendarDays className="size-5 shrink-0 text-text-3" />
            <span className="tnum flex-1 text-[16px] font-medium">{dateText(value)}</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="start"
            sideOffset={8}
            className="z-50 w-[304px] rounded-[18px] bg-popover p-3 shadow-float data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
            <div className="flex items-center justify-between gap-2 px-1 pb-2">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => step(-1)}
                className="press grid size-9 place-items-center rounded-full hover:bg-secondary"
              >
                <ChevronLeft className="size-4" />
              </button>
              <span className="text-[15px] font-semibold">{monthLabel}</span>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => step(1)}
                className="press grid size-9 place-items-center rounded-full hover:bg-secondary"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {WEEKDAYS.map((day, i) => (
                <span
                  // biome-ignore lint/suspicious/noArrayIndexKey: the weekday letters repeat (T, S).
                  key={i}
                  className="pb-1 text-[12px] font-semibold text-text-3"
                >
                  {day}
                </span>
              ))}
              {Array.from({ length: first }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: blank cells before the 1st.
                <span key={`blank-${i}`} />
              ))}
              {Array.from({ length: days }, (_, i) => {
                const day = i + 1
                const date = isoOf(view.year, view.month, day)
                const chosen = date === value
                const off = min !== undefined && date < min
                return (
                  <button
                    key={date}
                    type="button"
                    disabled={off}
                    aria-pressed={chosen}
                    aria-label={dateText(date)}
                    onClick={() => {
                      fire("tick", { cue: "toggle" })
                      onChange(date)
                      setOpen(false)
                    }}
                    className={cn(
                      "tnum mx-auto grid size-10 place-items-center rounded-full text-[15px] font-medium transition-colors",
                      chosen
                        ? "bg-shu font-semibold text-black"
                        : "hover:bg-secondary disabled:opacity-30 disabled:hover:bg-transparent",
                      !chosen && date === today && "shadow-[inset_0_0_0_1.5px_var(--shu)]",
                    )}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  )
}
