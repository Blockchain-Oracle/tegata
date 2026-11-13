import { Stamp } from "lucide-react"

import type { TaskStep } from "@/components/kit/task-steps"

/** "Zainab & Co." → "zainab-co": the pay-address suggestion from a business name. */
export const toHandle = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)

/** The account-opening steps, in the order the setup job completes them. A wallet's own account already exists. */
export function setupSteps(accountId: string, own = false): TaskStep[] {
  return [
    {
      id: "account",
      label: own ? `Using ${accountId}` : `Creating ${accountId}`,
      detail: own ? "your own NEAR account" : "on NEAR · fee paid by Tegata",
      mark: "near",
    },
    {
      id: "usdc",
      label: "Registering it for USDC",
      detail: "Circle's dollars on NEAR",
      mark: "usdc",
    },
    { id: "seal", label: "Cutting your seal", detail: "from your business name", icon: <Stamp /> },
  ]
}
