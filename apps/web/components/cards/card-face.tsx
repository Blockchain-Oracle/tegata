"use client"

// Tegata's card face (plan 6.8 AD): the owner's card is ink black with the vermilion seal; a person's card takes a
// story field so a team's cards are told apart at a glance. Frozen cards frost over with a snowflake.
import { Snowflake } from "lucide-react"

import { TegataSeal } from "@/components/brand/seal"
import { cn } from "@/lib/utils"

export type CardTone = "ink" | "matcha" | "sora" | "sakura" | "kin"

const TONE: Record<CardTone, { face: string; text: string; sub: string }> = {
  ink: {
    face: "bg-[radial-gradient(120%_90%_at_10%_0%,#2b2b2b_0%,#0b0b0b_62%)]",
    text: "text-white",
    sub: "text-white/70",
  },
  matcha: {
    face: "bg-[radial-gradient(120%_90%_at_10%_0%,#e2ff9e_0%,#b9e35a_70%)]",
    text: "text-black",
    sub: "text-black/60",
  },
  sora: {
    face: "bg-[radial-gradient(120%_90%_at_10%_0%,#d4ecff_0%,#8fcaff_70%)]",
    text: "text-black",
    sub: "text-black/60",
  },
  sakura: {
    face: "bg-[radial-gradient(120%_90%_at_10%_0%,#ffe0ea_0%,#ffadc8_70%)]",
    text: "text-black",
    sub: "text-black/60",
  },
  kin: {
    face: "bg-[radial-gradient(120%_90%_at_10%_0%,#fff1a8_0%,#ffcf2b_70%)]",
    text: "text-black",
    sub: "text-black/60",
  },
}

export function CardFace({
  tone,
  nickname,
  holder,
  last4,
  expiry,
  frozen = false,
  size = "md",
  className,
}: {
  tone: CardTone
  nickname: string
  holder: string
  last4: string
  expiry: string
  frozen?: boolean
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const t = TONE[tone]
  const small = size === "sm"
  return (
    <div
      className={cn(
        "relative aspect-[1.586] overflow-hidden rounded-[18px] shadow-[0_16px_36px_rgba(60,20,0,0.28)]",
        size === "sm"
          ? "w-[96px] rounded-[10px]"
          : size === "lg"
            ? "w-full max-w-[380px]"
            : "w-full max-w-[320px]",
        t.face,
        className,
      )}
    >
      {tone === "ink" ? (
        <span className="absolute -top-14 -right-14 size-44 rounded-full bg-shu/35 blur-2xl" />
      ) : null}
      {small ? (
        <div className="absolute inset-0 flex flex-col justify-between p-2">
          <TegataSeal size={14} textured={false} />
          <span className={cn("text-right font-mono text-[10px] font-semibold", t.text)}>
            ••{last4}
          </span>
        </div>
      ) : (
        <div className={cn("relative flex h-full flex-col justify-between p-5", t.text)}>
          <div className="flex items-start justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <TegataSeal size={26} textured={false} />
              <span className="truncate text-[15px] font-semibold">{nickname}</span>
            </span>
            <span className={cn("text-[11px] font-semibold", t.sub)}>Virtual</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="font-mono text-[17px] tracking-[0.16em]">•••• •••• •••• {last4}</span>
            <span className="flex items-end justify-between gap-3">
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-[13px] font-semibold">{holder}</span>
                <span className={cn("font-mono text-[11px]", t.sub)}>{expiry}</span>
              </span>
              <span className="text-[18px] font-black italic tracking-tight">VISA</span>
            </span>
          </div>
        </div>
      )}
      {frozen ? (
        <div className="absolute inset-0 grid place-items-center bg-white/45 backdrop-blur-[3px]">
          <span className="grid size-11 place-items-center rounded-full bg-white/90 text-[#1B1F5E] shadow">
            <Snowflake className="size-5" />
          </span>
        </div>
      ) : null}
    </div>
  )
}
