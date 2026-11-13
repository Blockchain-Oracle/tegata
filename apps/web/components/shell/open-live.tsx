"use client"

// The first time in Live: open the business's mainnet account. Same steps as Welcome (create on NEAR,
// register for USDC), real dollars from here, Tegata pays the network fee. A way back to the Sandbox is always there.
import { ArrowLeft, Radio } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/kit/button"
import { Stage } from "@/components/kit/stage"
import { TaskSteps } from "@/components/kit/task-steps"
import { Mark } from "@/components/marks/mark"
import { setupSteps } from "@/components/onboarding/setup"
import { ApiError, api } from "@/lib/client/api"
import { switchMode } from "@/lib/client/mode"
import type { AccountView } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

export function OpenLive({
  handle,
  wallet,
  account,
  onOpened,
}: {
  handle: string
  /** Signed in with a NEAR wallet: Live uses their own mainnet account. */
  wallet: string | null
  /** The mainnet account once requested (still opening until `readyAt`). */
  account: AccountView | undefined
  onOpened: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const accountId = account?.accountId ?? wallet ?? `${handle}.tegata.near`
  const current = !account ? 0 : account.readyAt ? 3 : account.createdTx || wallet ? 1 : 0

  async function open() {
    setBusy(true)
    setProblem(null)
    try {
      await api("/api/accounts/mainnet", { method: "POST" })
      fire("press", { cue: "tap" })
      onOpened()
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(error instanceof ApiError ? error.message : "Couldn't open it. Try again.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 pt-2">
      <Stage tone="lacquer" className="p-6 sm:p-8">
        <div className="flex max-w-[560px] flex-col gap-4">
          <span className="inline-flex items-center gap-2 text-[15px] font-semibold text-white/90">
            <Radio className="size-4" /> Live
          </span>
          <h1 className="display text-[44px] leading-[0.95] text-white sm:text-[56px]">
            {account ? "Opening your Live account." : "Open your Live account."}
          </h1>
          <p className="text-[17px] text-white/90">
            Real dollars from any chain, with no fees to pay.
          </p>
          <span className="inline-flex items-center gap-2 self-start rounded-full bg-white/15 px-3 py-1.5 font-mono text-[14px] text-white">
            <Mark id="near" size={18} /> {accountId}
          </span>
        </div>
      </Stage>

      {account ? (
        <TaskSteps steps={setupSteps(accountId, Boolean(wallet))} current={current} />
      ) : (
        <div className="flex flex-col gap-3">
          <Button cue="tap" busy={busy} onClick={() => void open()} className="self-start">
            Open {accountId}
          </Button>
          {problem ? <p className="text-[15px] font-medium text-down">{problem}</p> : null}
        </div>
      )}

      <button
        type="button"
        onClick={() => switchMode("sandbox")}
        className="inline-flex items-center gap-1.5 self-start text-[15px] font-semibold text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to the Sandbox
      </button>
    </div>
  )
}
