"use client"

// "Send to": a NEAR account or another chain, each with its real marks. Both are offered in the
// Sandbox too (R5); another chain then says why it runs in Live.
import { Mark, MarkStack } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

export type SendMode = "near" | "chain"

const OPTIONS: { value: SendMode; label: string; mark: React.ReactNode }[] = [
  { value: "near", label: "A NEAR account", mark: <Mark id="near" size={20} /> },
  {
    value: "chain",
    label: "Another chain",
    mark: <MarkStack ids={["eth", "sol", "tron"]} size={18} />,
  },
]

export function SendToSwitch({
  value,
  onChange,
}: {
  value: SendMode
  onChange: (mode: SendMode) => void
}) {
  const pick = (mode: SendMode) => {
    if (mode === value) return
    fire("tick")
    onChange(mode)
  }
  return (
    <div
      role="radiogroup"
      aria-label="Send to"
      className="grid grid-cols-2 gap-1 rounded-[14px] bg-secondary p-1"
    >
      {OPTIONS.map((option) => (
        // biome-ignore lint/a11y/useSemanticElements: a native radio can't carry the marks and the plate.
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          tabIndex={option.value === value ? 0 : -1}
          onClick={() => pick(option.value)}
          onKeyDown={(e) => {
            if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) {
              e.preventDefault()
              pick(value === "near" ? "chain" : "near")
            }
          }}
          className={cn(
            "press inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-3 text-[14px] font-semibold transition-colors",
            option.value === value
              ? "bg-card text-foreground shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.mark}
          {option.label}
        </button>
      ))}
    </div>
  )
}
