"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

import { type CustomerForm, CustomersView } from "@/components/customers/customers-view"
import { ApiError, api } from "@/lib/client/api"
import type { Customer } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

// `?id=<customer>` opens their sheet: customer names on invoices link here.
export default function CustomersPage() {
  return (
    <Suspense>
      <Customers />
    </Suspense>
  )
}

function Customers() {
  const queryClient = useQueryClient()
  const openId = useSearchParams().get("id")
  const customers = useQuery({
    queryKey: ["customers"],
    queryFn: () => api<{ customers: Customer[] }>("/api/customers"),
    select: (data) => data.customers,
  })
  const save = useMutation({
    mutationFn: ({ id, form }: { id: string | null; form: CustomerForm; done: () => void }) =>
      id
        ? api(`/api/customers/${id}`, { method: "PATCH", body: form })
        : api("/api/customers", { body: form }),
    onSuccess: (_, { done }) => {
      fire("tick", { cue: "confirmed" })
      void queryClient.invalidateQueries({ queryKey: ["customers"] })
      done()
    },
    onError: () => fire("fail", { cue: "error" }),
  })
  return (
    <CustomersView
      openId={openId}
      customers={customers.data}
      error={customers.isError && !customers.data}
      onRetry={() => void customers.refetch()}
      saving={save.isPending}
      problem={
        save.error
          ? save.error instanceof ApiError
            ? save.error.message
            : "Couldn't save. Try again."
          : null
      }
      onSave={(id, form, done) => save.mutate({ id, form, done })}
    />
  )
}
