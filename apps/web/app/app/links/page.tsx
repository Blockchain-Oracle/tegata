"use client"

// Pay links: the logic behind LinksView and the new-link sheet. `?new=1` opens the sheet (Home's tile, ⌘K).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter, useSearchParams } from "next/navigation"
import { Suspense, useState } from "react"

import { LinksView } from "@/components/links/links-view"
import { type NewLinkInput, NewLinkSheet } from "@/components/links/new-link-sheet"
import { useProfile } from "@/hooks/use-profile"
import { ApiError, api } from "@/lib/client/api"
import type { PayLink } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

export default function LinksPage() {
  return (
    <Suspense>
      <Links />
    </Suspense>
  )
}

function Links() {
  const router = useRouter()
  const params = useSearchParams()
  const queryClient = useQueryClient()
  const { profile } = useProfile()
  const [open, setOpen] = useState(params.get("new") === "1")

  const links = useQuery({
    queryKey: ["links"],
    queryFn: () => api<{ links: PayLink[] }>("/api/links"),
    select: (data) => data.links,
  })

  const create = useMutation({
    mutationFn: (input: NewLinkInput) => api<{ link: PayLink }>("/api/links", { body: input }),
    onSuccess: ({ link }) => {
      void queryClient.invalidateQueries({ queryKey: ["links"] })
      setOpen(false)
      router.push(`/app/links/${link.id}?new=1`)
    },
    onError: () => fire("fail", { cue: "error" }),
  })

  return (
    <>
      <LinksView
        links={links.data}
        error={links.isError}
        onRetry={() => void links.refetch()}
        onNew={() => {
          create.reset()
          setOpen(true)
        }}
      />
      <NewLinkSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next && params.get("new")) router.replace("/app/links")
        }}
        businessName={profile?.workspace?.name ?? "Your business"}
        creating={create.isPending}
        problem={
          create.error
            ? create.error instanceof ApiError
              ? create.error.message
              : "Couldn't create the link. Try again."
            : null
        }
        onCreate={(input) => create.mutate(input)}
      />
    </>
  )
}
