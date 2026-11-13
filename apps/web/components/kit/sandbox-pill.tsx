// The Sandbox note: one dashed pill, never a paragraph. "Sandbox · Noah's test bank", "Live only · real price".
import { cn } from "@/lib/utils"

export function SandboxPill({
  children,
  className,
  tone = "default",
}: {
  children: React.ReactNode
  className?: string
  /** On the stage the rim and text are white. */
  tone?: "default" | "stage"
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1.5 rounded-full border border-dashed px-3 py-1 text-[13px] font-medium",
        tone === "stage" ? "border-white/60 text-white" : "border-border text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  )
}
