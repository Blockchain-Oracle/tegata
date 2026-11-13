"use client"

// Business profile: the logic behind BusinessView. Saving refreshes the profile everywhere (the rail's seal, the
// pay page and receipts read the same business).
import { useMutation, useQueryClient } from "@tanstack/react-query"

import { Skeleton } from "@/components/kit/states"
import {
  type BusinessDraft,
  type BusinessFieldName,
  BusinessView,
} from "@/components/settings/business-view"
import { EmailsCard } from "@/components/settings/emails-card"
import { useNetwork } from "@/hooks/use-network"
import { useProfile } from "@/hooks/use-profile"
import { ApiError, api } from "@/lib/client/api"
import type { Profile } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const FIELDS: BusinessFieldName[] = ["name", "address", "taxId", "email", "timezone", "logo"]

export default function SettingsPage() {
  const { profile } = useProfile()
  const queryClient = useQueryClient()

  const save = useMutation({
    mutationFn: ({ draft, logoChanged }: { draft: BusinessDraft; logoChanged: boolean }) =>
      api<{ workspace: NonNullable<Profile["workspace"]> }>("/api/business", {
        method: "PATCH",
        body: {
          name: draft.name,
          address: draft.address,
          taxId: draft.taxId,
          email: draft.email,
          timezone: draft.timezone,
          ...(logoChanged ? { logo: draft.logo } : {}),
        },
      }),
    onSuccess: ({ workspace }) => {
      fire("filled", { cue: "confirmed" })
      queryClient.setQueryData<Profile>(["me"], (old) => (old ? { ...old, workspace } : old))
    },
    onError: () => fire("fail", { cue: "error" }),
  })

  const workspace = profile?.workspace
  const network = useNetwork()
  const account = profile?.accounts.find((entry) => entry.network === network)
  if (!profile || !workspace || !account)
    return (
      <div className="flex flex-col gap-6" role="status" aria-label="Loading your business">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
          <Skeleton className="h-[340px] rounded-[24px]" />
          <Skeleton className="h-[560px] rounded-[24px]" />
        </div>
      </div>
    )

  const error = save.error
  const field =
    error instanceof ApiError && FIELDS.includes(error.code as BusinessFieldName)
      ? (error.code as BusinessFieldName)
      : null

  return (
    <div className="flex flex-col gap-6">
      <BusinessView
        // A fresh form after each save, so "changed" is measured against what was stored.
        key={`${workspace.name}|${workspace.logo}|${workspace.address}|${workspace.taxId}|${workspace.email}|${workspace.timezone}`}
        initial={{
          name: workspace.name,
          address: workspace.address ?? "",
          taxId: workspace.taxId ?? "",
          email: workspace.email ?? "",
          timezone: workspace.timezone,
          logo: workspace.logo,
        }}
        accountId={account.accountId}
        signInEmail={
          profile.user.walletAccountId
            ? `${profile.user.walletAccountId} (NEAR wallet)`
            : profile.user.email
        }
        saving={save.isPending}
        problem={
          error
            ? {
                field,
                message: error instanceof ApiError ? error.message : "Couldn't save. Try again.",
              }
            : null
        }
        onSave={(draft, logoChanged) => save.mutate({ draft, logoChanged })}
      />
      <EmailsCard businessName={workspace.name} />
    </div>
  )
}
