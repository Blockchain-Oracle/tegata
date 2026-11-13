"use client"

// Pay links in every state (plan 6.9): the list (empty, loading, full, error), the new-link sheet, and one link's
// page (just created with the seal press, with payments, with none), on sample data that lives only under /dev.
import { useState } from "react"

import { Button } from "@/components/kit/button"
import { Segmented } from "@/components/kit/segmented"
import { LinkDetailView } from "@/components/links/link-detail-view"
import { LinksView } from "@/components/links/links-view"
import { NewLinkSheet } from "@/components/links/new-link-sheet"
import { SAMPLE_BUSINESS, SAMPLE_DETAIL, SAMPLE_LINKS } from "@/lib/dev/sample"

type ListState = "full" | "empty" | "loading" | "error"
type DetailState = "fresh" | "paid" | "none" | "loading" | "error"

export default function LinksFlow() {
  const [list, setList] = useState<ListState>("full")
  const [detail, setDetail] = useState<DetailState>("paid")
  const [sheet, setSheet] = useState(false)
  const [creating, setCreating] = useState(false)
  const [replay, setReplay] = useState(0)
  const [open, setOpen] = useState(true)

  const request = {
    ...SAMPLE_DETAIL.request,
    status: open ? ("open" as const) : ("closed" as const),
  }

  return (
    <div className="flex flex-col gap-10 pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <span className="display text-[30px]">Pay links</span>
        <Segmented
          label="List state"
          value={list}
          onValueChange={(v) => setList(v as ListState)}
          options={[
            { value: "full", label: "With links" },
            { value: "empty", label: "Empty" },
            { value: "loading", label: "Loading" },
            { value: "error", label: "Error" },
          ]}
        />
        <Button variant="secondary" size="sm" onClick={() => setSheet(true)}>
          Open the new-link sheet
        </Button>
      </div>
      <LinksView
        links={list === "full" ? SAMPLE_LINKS : list === "empty" ? [] : undefined}
        error={list === "error"}
        onRetry={() => setList("full")}
        onNew={() => setSheet(true)}
      />
      <NewLinkSheet
        open={sheet}
        onOpenChange={setSheet}
        businessName={SAMPLE_BUSINESS}
        creating={creating}
        problem={null}
        onCreate={() => {
          setCreating(true)
          setTimeout(() => {
            setCreating(false)
            setSheet(false)
            setDetail("fresh")
            setReplay((n) => n + 1)
          }, 900)
        }}
      />

      <div className="flex flex-wrap items-center gap-3 pt-8">
        <span className="display text-[30px]">One link</span>
        <Segmented
          label="Link state"
          value={detail}
          onValueChange={(v) => {
            setDetail(v as DetailState)
            if (v === "fresh") setReplay((n) => n + 1)
          }}
          options={[
            { value: "fresh", label: "Just created" },
            { value: "paid", label: "With payments" },
            { value: "none", label: "No payments" },
            { value: "loading", label: "Loading" },
            { value: "error", label: "Error" },
          ]}
        />
      </div>
      <LinkDetailView
        key={replay}
        detail={
          detail === "loading" || detail === "error"
            ? undefined
            : detail === "paid"
              ? { request, payments: SAMPLE_DETAIL.payments }
              : { request: { ...request, paidCount: 0, paidTotal: "0" }, payments: [] }
        }
        error={detail === "error"}
        businessName={SAMPLE_BUSINESS}
        url={`https://tegata.xyz/pay/${request.token}`}
        fresh={detail === "fresh"}
        toggling={false}
        onToggle={setOpen}
        onRetry={() => setDetail("paid")}
      />
    </div>
  )
}
