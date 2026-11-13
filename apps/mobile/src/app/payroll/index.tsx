// Payroll on the phone: the next payday, the run to approve (drafted here when the payday has come), and past runs.
// Schedules and people are edited on the web; approving is a hold on the phone (M9).
import { useMutation, useQuery } from "@tanstack/react-query"
import { router } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { Banknote, Users } from "lucide-react-native"
import { View } from "react-native"

import { ApiError, api, webUrl } from "@/api/client"
import type { PayrollOverview } from "@/api/types"
import { queryClient, useSession } from "@/auth/session"
import { fire } from "@/feedback/fire"
import { usd } from "@/lib/money"
import { PAPER, usePalette } from "@/theme/tokens"
import { Card, Chip, Header, Problem, Row, Screen, SectionTitle, StoryTile } from "@/ui/layout"
import { Skeleton } from "@/ui/shimmer"
import { T } from "@/ui/text"

const STATUS: Record<string, { label: string; tone: "up" | "warn" | "down" | "seal" }> = {
  draft: { label: "To approve", tone: "seal" },
  approved: { label: "Paying", tone: "warn" },
  paid: { label: "Paid", tone: "up" },
  failed: { label: "Didn't go through", tone: "down" },
}

export default function Payroll() {
  const p = usePalette()
  const { network } = useSession()
  const overview = useQuery({
    queryKey: ["payroll", network],
    queryFn: () => api<PayrollOverview>("/api/payroll"),
  })
  const due = useQuery({
    queryKey: ["payroll-due", network],
    queryFn: () =>
      api<{ due: { payday: string; people: number; total: string } | null }>("/api/payroll/due"),
    select: (d) => d.due,
  })
  const draft = useMutation({
    mutationFn: () => api<{ runId: string }>("/api/payroll/runs", { method: "POST" }),
    onSuccess: ({ runId }) => {
      void queryClient.invalidateQueries({ queryKey: ["payroll"] })
      fire("tick", { cue: "step" })
      router.push({ pathname: "/payroll/[id]", params: { id: runId } })
    },
    onError: () => fire("fail", { cue: "error" }),
  })
  const runs = overview.data?.runs ?? []
  const open = runs.find((run) => run.status === "draft")

  return (
    <Screen onRefresh={() => overview.refetch()}>
      <Header title="Payroll" />
      {overview.isPending ? (
        <Skeleton width="100%" height={88} radius={20} />
      ) : overview.isError ? (
        overview.error instanceof ApiError && overview.error.code === "no_business" ? (
          <Problem text="Name your business first." />
        ) : (
          <Problem
            text="Couldn't load payroll."
            action="Retry"
            onAction={() => void overview.refetch()}
          />
        )
      ) : (
        <>
          {open ? (
            <StoryTile
              field="kin"
              icon={<Banknote size={24} color={PAPER.ink} />}
              title={open.label}
              line={`${usd(open.total)} to ${open.people} ${open.people === 1 ? "person" : "people"}`}
              action="Review"
              onPress={() => router.push({ pathname: "/payroll/[id]", params: { id: open.id } })}
            />
          ) : due.data ? (
            <StoryTile
              field="kin"
              icon={<Banknote size={24} color={PAPER.ink} />}
              title="Payday has come"
              line={
                draft.error instanceof ApiError
                  ? draft.error.message
                  : `${usd(due.data.total)} to ${due.data.people} ${due.data.people === 1 ? "person" : "people"}`
              }
              action={draft.isPending ? "Drafting…" : "Draft the run"}
              onPress={draft.isPending ? undefined : () => draft.mutate()}
            />
          ) : (
            <StoryTile
              field="kin"
              icon={<Users size={24} color={PAPER.ink} />}
              title={
                overview.data?.schedule
                  ? `Next payday · ${overview.data.schedule.label}`
                  : "Set up payroll"
              }
              line={
                overview.data?.schedule
                  ? "Its run appears here to approve."
                  : "Add people and a schedule on the web."
              }
              action={overview.data?.schedule ? undefined : "Open"}
              onPress={
                overview.data?.schedule
                  ? undefined
                  : () => void WebBrowser.openBrowserAsync(webUrl("/app/payroll"))
              }
            />
          )}
          {runs.length > 0 ? (
            <>
              <SectionTitle title="Runs" />
              <Card>
                {runs.map((run) => {
                  const status = STATUS[run.status] ?? STATUS.draft
                  return (
                    <Row
                      key={run.id}
                      chevron
                      onPress={() =>
                        router.push({ pathname: "/payroll/[id]", params: { id: run.id } })
                      }
                      left={
                        <View
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 20,
                            backgroundColor: p.plate,
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          <Banknote size={20} color={p.ink} />
                        </View>
                      }
                      title={run.label}
                      meta={
                        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                          <T role="detail" tone="text2">
                            {usd(run.total)} · {run.people} {run.people === 1 ? "person" : "people"}
                          </T>
                          {status ? <Chip label={status.label} tone={status.tone} /> : null}
                        </View>
                      }
                    />
                  )
                })}
              </Card>
            </>
          ) : null}
        </>
      )}
    </Screen>
  )
}
