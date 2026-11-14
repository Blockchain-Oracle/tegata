// M9 Approve a payroll run: the total on the kin field, each person with where their pay lands and a switch to leave
// them out, then one hold that signs every all-or-nothing batch. Before signing, every batch the server built is
// re-encoded on the phone and checked row by row (who, which account, how much, which memo), exactly as the web does.
// After approval the rows tick to Paid and the business seal presses "PAID" on the field.
import { useMutation, useQuery } from "@tanstack/react-query"
import { router, useLocalSearchParams } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { Check } from "lucide-react-native"
import { useEffect, useRef, useState } from "react"
import { Switch, View } from "react-native"
import Animated, { ZoomIn } from "react-native-reanimated"

import { api } from "@/api/client"
import type { PayRun, PayRunRow, RunBatchDraft } from "@/api/types"
import { queryClient, useSession } from "@/auth/session"
import { NETWORKS } from "@/config"
import { fire } from "@/feedback/fire"
import { usd } from "@/lib/money"
import { DraftMismatch, ftTransfers } from "@/near/draft"
import { SHU, usePalette } from "@/theme/tokens"
import { Button } from "@/ui/button"
import { Figure } from "@/ui/figure"
import { HoldButton } from "@/ui/hold-button"
import { Card, Chip, Header, Problem, Row, Screen } from "@/ui/layout"
import { Mark } from "@/ui/mark"
import { BusinessSeal } from "@/ui/seal"
import { SealPress } from "@/ui/seal-press"
import { Skeleton } from "@/ui/shimmer"
import { T } from "@/ui/text"

/** Throws unless the batches pay exactly the included rows on screen. */
function checkBatches(batches: RunBatchDraft[], run: PayRun, usdc: string) {
  const expected = new Map(
    run.rows.filter((r) => r.status === "included").map((r) => [r.id, r] as const),
  )
  let covered = 0
  for (const batch of batches) {
    const transfers = ftTransfers(batch.draft, usdc)
    if (transfers.length !== batch.rows.length) throw new DraftMismatch()
    transfers.forEach((args, i) => {
      const planned = batch.rows[i]
      const row = expected.get(planned?.id ?? "")
      const chain = row?.destinationKind === "chain"
      const right = chain
        ? planned?.via?.recipient === row.accountId &&
          planned?.via?.route === row.route &&
          args.receiver_id === planned?.accountId &&
          /^[0-9a-f]{64}$/.test(args.receiver_id ?? "") &&
          args.memo === undefined
        : args.receiver_id === row?.accountId && args.memo === `tegata:payroll:${row?.id}`
      if (!row || args.amount !== row.amount || !right) throw new DraftMismatch()
      covered++
    })
  }
  if (covered !== expected.size) throw new DraftMismatch()
}

function Destination({ row }: { row: PayRunRow }) {
  if (row.destinationKind === "chain" && row.route) {
    const [coin = "usdc", chain = "near"] = row.route.split("-")
    return <Mark id={coin} chain={chain} size={32} />
  }
  return <Mark id={row.destinationKind ? "near" : "unknown"} size={32} />
}

export default function Run() {
  const p = usePalette()
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile, account, sign, network } = useSession()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const run = useQuery({
    queryKey: ["run", id],
    queryFn: () => api<{ run: PayRun }>(`/api/payroll/runs/${id}`),
    select: (d) => d.run,
    refetchInterval: (q) => (q.state.data?.run.status === "approved" ? 1500 : false),
  })
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["run", id] })
    void queryClient.invalidateQueries({ queryKey: ["payroll"] })
    void queryClient.invalidateQueries({ queryKey: ["payroll-due"] })
    void queryClient.invalidateQueries({ queryKey: ["me"] })
    void queryClient.invalidateQueries({ queryKey: ["activity"] })
  }
  const toggle = useMutation({
    mutationFn: ({ row, included }: { row: PayRunRow; included: boolean }) =>
      api(`/api/payroll/runs/${id}/rows/${row.id}`, { method: "PATCH", body: { included } }),
    onSettled: refresh,
  })

  const data = run.data
  const paidRows = data?.rows.filter((r) => r.status === "paid").length ?? 0
  const lastPaid = useRef(paidRows)
  useEffect(() => {
    if (paidRows > lastPaid.current) fire("tick")
    lastPaid.current = paidRows
  }, [paidRows])
  useEffect(() => {
    if (data?.status === "paid") fire("filled", { cue: "sent", identity: `run-${data.id}` })
  }, [data?.status, data?.id])

  async function pay() {
    if (!data) return
    setBusy(true)
    setProblem(null)
    try {
      const { batches } = await api<{ batches: RunBatchDraft[] }>(
        `/api/payroll/runs/${id}/prepare`,
        { method: "POST" },
      )
      checkBatches(batches, data, NETWORKS[data.network].usdc)
      const signatures = []
      for (const batch of batches)
        signatures.push({ relayId: batch.relayId, signature: await sign(batch.draft) })
      await api(`/api/payroll/runs/${id}/approve`, { body: { signatures } })
      fire("confirm")
      refresh()
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(error instanceof Error ? error.message : "Couldn't approve the run")
      refresh()
    } finally {
      setBusy(false)
    }
  }

  if (!data)
    return (
      <Screen>
        <Header title="Payroll run" />
        {run.isError ? (
          <Problem
            text="Couldn't load the run."
            action="Retry"
            onAction={() => void run.refetch()}
          />
        ) : (
          <Skeleton width="100%" height={180} radius={20} />
        )}
      </Screen>
    )

  const included = data.rows.filter((r) => r.status === "included" || r.status === "paid")
  const total = BigInt(data.total)
  const balance = BigInt(account?.balance ?? "0")
  const short = data.status === "draft" && total > balance
  const business = profile?.workspace?.name ?? "Your business"
  const paid = data.status === "paid"

  return (
    <Screen onRefresh={() => run.refetch()}>
      <Header title={data.label} />
      <View
        style={{
          backgroundColor: paid ? p.matcha : p.kin,
          borderRadius: 24,
          padding: 20,
          gap: 6,
          overflow: "hidden",
        }}
      >
        <T role="detailMedium" color={`${p.fieldInk}B3`}>
          {paid ? "Paid" : data.status === "approved" ? "Paying on NEAR" : "Payroll to approve"}
        </T>
        <Figure units={data.total} size={52} color={p.fieldInk} />
        <T role="bodyMedium" color={`${p.fieldInk}B3`}>
          to {included.length} {included.length === 1 ? "person" : "people"} · payday{" "}
          {new Date(`${data.payday}T12:00:00`).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
          })}
        </T>
        {data.status === "draft" ? (
          <T role="detail" color={short ? p.down : `${p.fieldInk}B3`}>
            {short
              ? `Your balance is ${usd(balance)}. Add money first.`
              : `Balance after: ${usd(balance - total)}`}
          </T>
        ) : null}
        {paid ? (
          <View style={{ position: "absolute", right: 14, top: 14 }}>
            <SealPress identity={`run-seal-${data.id}`}>
              <BusinessSeal name={business} band="Paid" size={92} />
            </SealPress>
          </View>
        ) : null}
      </View>

      <Card>
        {data.rows.map((row) => (
          <Row
            key={row.id}
            left={<Destination row={row} />}
            title={row.name}
            meta={
              row.status === "skipped"
                ? (row.skipReason ?? "Hasn't chosen where pay lands")
                : (row.accountId ?? row.role ?? "")
            }
            right={
              <View style={{ alignItems: "flex-end", gap: 4 }}>
                <T
                  role="rowTitle"
                  tone={row.status === "excluded" || row.status === "skipped" ? "text3" : "ink"}
                >
                  {usd(row.amount)}
                </T>
                {row.status === "paid" ? (
                  <Animated.View
                    entering={ZoomIn.springify()}
                    style={{ flexDirection: "row", alignItems: "center", gap: 4 }}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        backgroundColor: p.up,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Check size={10} color={p.page} strokeWidth={3} />
                    </View>
                    <T role="meta" tone="up">
                      Paid
                    </T>
                  </Animated.View>
                ) : row.status === "failed" ? (
                  <Chip label="Didn't go through" tone="down" />
                ) : data.status === "draft" &&
                  (row.status === "included" || row.status === "excluded") ? (
                  <Switch
                    value={row.status === "included"}
                    onValueChange={(on) => {
                      fire("tick", { cue: "toggle" })
                      toggle.mutate({ row, included: on })
                    }}
                    trackColor={{ true: SHU, false: p.pressed }}
                    style={{ transform: [{ scale: 0.8 }] }}
                  />
                ) : null}
              </View>
            }
          />
        ))}
      </Card>

      {problem ? <Problem text={`${problem} Nothing moved.`} /> : null}
      {data.status === "draft" ? (
        <HoldButton
          label={`Pay ${included.length} ${included.length === 1 ? "person" : "people"} · ${usd(data.total)}`}
          busy={busy || toggle.isPending}
          busyLabel="Approving"
          disabled={short || included.length === 0}
          disabledReason={short ? "Not enough in your balance" : "Nobody is in this run"}
          onConfirm={pay}
        />
      ) : null}
      {data.transactions.length > 0 ? (
        <Button
          variant="secondary"
          label={
            data.transactions.length > 1
              ? `Open on NEAR · ${data.transactions.length} batches`
              : "Open on NEAR"
          }
          icon={<Mark id="near" size={20} />}
          onPress={() =>
            void WebBrowser.openBrowserAsync(
              data.transactions[0]?.url ?? NETWORKS[network].explorer,
            )
          }
        />
      ) : null}
      {paid ? <Button label="Done" onPress={() => router.back()} /> : null}
    </Screen>
  )
}
