"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState } from "react"

import { ImportSheet } from "@/components/people/import-sheet"
import { PeopleView } from "@/components/people/people-view"
import { AddPersonSheet, type PersonForm, PersonSheet } from "@/components/people/person-sheet"
import { ApiError, api } from "@/lib/client/api"
import type { PaySlipRow, TeamPerson } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const message = (error: unknown, fallback: string) =>
  error ? (error instanceof ApiError ? error.message : fallback) : null

export default function PeoplePage() {
  const queryClient = useQueryClient()
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)

  const team = useQuery({
    queryKey: ["people"],
    queryFn: () => api<{ people: TeamPerson[]; emailEnabled: boolean }>("/api/people"),
  })
  const open = team.data?.people.find((p) => p.id === openId) ?? null
  const detail = useQuery({
    queryKey: ["person", openId],
    queryFn: () => api<{ person: TeamPerson; slips: PaySlipRow[] }>(`/api/people/${openId}`),
    enabled: Boolean(openId),
  })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["people"] })
    void queryClient.invalidateQueries({ queryKey: ["person"] })
    void queryClient.invalidateQueries({ queryKey: ["payroll"] })
  }

  const add = useMutation({
    mutationFn: (form: PersonForm) =>
      api<{ id: string; token: string; emailed: boolean }>("/api/people", { body: form }),
    onSuccess: (res) => {
      fire("tick", { cue: "confirmed" })
      refresh()
      setAdding(false)
      // Not emailed: open their sheet, where their link is ready to copy or share.
      if (!res.emailed) setOpenId(res.id)
    },
    onError: () => fire("fail", { cue: "error" }),
  })
  const save = useMutation({
    mutationFn: (form: PersonForm) => api(`/api/people/${openId}`, { method: "PATCH", body: form }),
    onSuccess: () => {
      fire("tick", { cue: "confirmed" })
      refresh()
    },
    onError: () => fire("fail", { cue: "error" }),
  })
  const setAccount = useMutation({
    mutationFn: (accountId: string) =>
      api(`/api/people/${openId}/destination`, { method: "PUT", body: { accountId } }),
    onSuccess: () => {
      fire("tick", { cue: "confirmed" })
      refresh()
    },
    onError: () => fire("fail", { cue: "error" }),
  })
  const remove = useMutation({
    mutationFn: () => api(`/api/people/${openId}`, { method: "DELETE" }),
    onSuccess: () => {
      setOpenId(null)
      refresh()
    },
  })
  const upload = useMutation({
    mutationFn: (csv: string) =>
      api<{ added: number; problems: { line: number; message: string }[] }>("/api/people/import", {
        body: { csv },
      }),
    onSuccess: (res) => {
      fire("tick", { cue: res.added ? "confirmed" : "error" })
      refresh()
    },
  })

  return (
    <>
      <PeopleView
        people={team.data?.people}
        error={team.isError && !team.data}
        onRetry={() => void team.refetch()}
        onAdd={() => {
          add.reset()
          setAdding(true)
        }}
        onImport={() => {
          upload.reset()
          setImporting(true)
        }}
        onOpen={(person) => {
          save.reset()
          setAccount.reset()
          setOpenId(person.id)
        }}
      />
      <AddPersonSheet
        open={adding}
        onOpenChange={setAdding}
        emailEnabled={team.data?.emailEnabled ?? false}
        saving={add.isPending}
        problem={message(add.error, "Couldn't add them. Try again.")}
        onSave={(form) => add.mutate(form)}
      />
      <ImportSheet
        open={importing}
        onOpenChange={setImporting}
        importing={upload.isPending}
        result={upload.data ?? null}
        onImport={(csv) => upload.mutate(csv)}
      />
      <PersonSheet
        person={open}
        slips={detail.data?.slips}
        onOpenChange={(o) => !o && setOpenId(null)}
        saving={save.isPending}
        problem={message(save.error, "Couldn't save. Try again.")}
        onSave={(form) => save.mutate(form)}
        onSetAccount={(accountId) => setAccount.mutate(accountId)}
        settingAccount={setAccount.isPending}
        accountProblem={message(setAccount.error, "Couldn't use that account. Try again.")}
        onRemove={() => remove.mutate()}
        removing={remove.isPending}
      />
    </>
  )
}
