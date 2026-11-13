"use client"

import { useQuery } from "@tanstack/react-query"

import { type ApprovalItem, ApprovalsList } from "@/components/team/approvals-view"
import { useNetwork } from "@/hooks/use-network"
import { api } from "@/lib/client/api"

const POLL_MS = 10_000

export default function ApprovalsPage() {
  const network = useNetwork()
  const list = useQuery({
    queryKey: ["approvals", network],
    queryFn: () => api<{ approvals: ApprovalItem[] }>("/api/approvals"),
    select: (data) => data.approvals,
    refetchInterval: POLL_MS,
  })
  return (
    <ApprovalsList
      items={list.data}
      error={list.isError && !list.data}
      onRetry={() => void list.refetch()}
    />
  )
}
