// M3 Home: the balance on the lit stage (rolling figure, USDC-on-NEAR mark), four white actions, then only what is
// true now (payroll due, Sandbox test dollars), then the latest five movements. Money arriving plays `received` once.
import { useMutation, useQuery } from "@tanstack/react-query"
import { router } from "expo-router"
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Check,
  ChevronRight,
  Link2,
  Plus,
  ScanLine,
} from "lucide-react-native"
import { type ReactNode, useEffect, useRef, useState } from "react"
import { View } from "react-native"
import Animated, { FadeInDown } from "react-native-reanimated"

import { ApiError, api } from "@/api/client"
import type { ActivityItem } from "@/api/types"
import { queryClient, useSession } from "@/auth/session"
import { ActivityRow } from "@/features/activity/activity-row"
import { fire } from "@/feedback/fire"
import { usd } from "@/lib/money"
import { PAPER, SHADOW } from "@/theme/tokens"
import { Figure } from "@/ui/figure"
import { Card, Problem, SandboxPill, Screen, SectionTitle, StoryTile } from "@/ui/layout"
import { Mark } from "@/ui/mark"
import { ModeCapsule } from "@/ui/mode-capsule"
import { Press } from "@/ui/press"
import { BusinessSeal, TegataSeal } from "@/ui/seal"
import { Skeleton } from "@/ui/shimmer"
import { Stage } from "@/ui/stage"
import { TaskSteps } from "@/ui/task-steps"
import { T } from "@/ui/text"

interface Due {
  payday: string
  people: number
  total: string
}

function StageAction({
  label,
  icon,
  onPress,
}: {
  label: string
  icon: ReactNode
  onPress: () => void
}) {
  return (
    <Press
      haptic="tick"
      onPress={onPress}
      accessibilityLabel={label}
      style={{ alignItems: "center", gap: 8, width: 72 }}
    >
      <View
        style={[
          {
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: PAPER.face,
            alignItems: "center",
            justifyContent: "center",
          },
          SHADOW.object,
        ]}
      >
        {icon}
      </View>
      <T role="detailMedium" tone="white">
        {label}
      </T>
    </Press>
  )
}

const paydayWord = (day: string) => {
  const today = new Date().toISOString().slice(0, 10)
  if (day === today) return "Today"
  return new Date(`${day}T12:00:00`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  })
}

export default function Home() {
  const { profile, account, network, refetchProfile, profileError } = useSession()
  const sandbox = network === "testnet"
  const name = profile?.workspace?.name ?? "Your business"

  const activity = useQuery({
    queryKey: ["activity", network],
    queryFn: () => api<{ items: ActivityItem[] }>("/api/activity"),
    select: (data) => data.items.filter((item) => item.network === network).slice(0, 5),
  })
  const due = useQuery({
    queryKey: ["payroll-due", network],
    queryFn: () => api<{ due: Due | null }>("/api/payroll/due"),
    select: (data) => data.due,
  })

  // Money in: the balance rose since the last look.
  const last = useRef<bigint | null>(null)
  useEffect(() => {
    if (!account?.balance) return
    const now = BigInt(account.balance)
    if (last.current !== null && now > last.current)
      fire("filled", { cue: "received", identity: `balance:${account.balance}` })
    last.current = now
  }, [account?.balance])

  const [grant, setGrant] = useState<string | null>(null)
  const testDollars = useMutation({
    mutationFn: () => api<{ id: string; status: string }>("/api/test-dollars", { method: "POST" }),
    onSuccess: (data) => setGrant(data.id),
    onError: () => fire("fail", { cue: "error" }),
  })
  const grantStatus = useQuery({
    queryKey: ["test-dollars", grant],
    queryFn: () => api<{ status: "queued" | "sent" | "failed" }>(`/api/test-dollars/${grant}`),
    enabled: Boolean(grant),
    refetchInterval: (q) => (q.state.data && q.state.data.status !== "queued" ? false : 1500),
  })
  useEffect(() => {
    if (grantStatus.data?.status === "sent")
      void queryClient.invalidateQueries({ queryKey: ["me"] })
  }, [grantStatus.data?.status])

  const opening = account && !account.readyAt
  const refreshing = activity.isRefetching
  return (
    <Screen
      dock
      refreshing={refreshing}
      onRefresh={() => {
        refetchProfile()
        void activity.refetch()
        void due.refetch()
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TegataSeal size={32} tilt={-4} />
          <ModeCapsule />
        </View>
        <Press haptic="tick" onPress={() => router.push("/you")} accessibilityLabel="You">
          <BusinessSeal name={name} size={40} tilt={0} />
        </Press>
      </View>

      <View style={{ gap: 2 }}>
        <T role="pageTitle" numberOfLines={1}>
          {name}
        </T>
        {account ? (
          <T role="mono" tone="text2">
            {account.accountId}
          </T>
        ) : null}
      </View>

      <Stage style={{ padding: 20, gap: 22 }}>
        <View style={{ gap: 6 }}>
          <Press
            haptic="tick"
            onPress={() => router.push("/activity")}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, alignSelf: "flex-start" }}
          >
            <Mark id="usdc" chain="near" size={22} />
            <T role="bodyMedium" color="#FFFFFFD9">
              Balance · USDC on NEAR
            </T>
            <ChevronRight size={16} color="#FFFFFFD9" />
          </Press>
          {opening ? (
            <View style={{ paddingVertical: 8 }}>
              <TaskSteps
                steps={["Creating your account on NEAR", "Registering for USDC", "Ready"]}
                current={account.registeredTx ? 2 : account.createdTx ? 1 : 0}
                onDark
              />
            </View>
          ) : account?.balance !== undefined ? (
            <Figure units={account.balance} size={58} color="#FFFFFF" />
          ) : (
            <Skeleton width={210} height={58} light radius={14} />
          )}
          {sandbox ? <SandboxPill onStage /> : null}
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <StageAction
            label="Get paid"
            icon={<ArrowDownLeft size={24} color={PAPER.ink} />}
            onPress={() => router.push("/get-paid")}
          />
          <StageAction
            label="Send"
            icon={<ArrowUpRight size={24} color={PAPER.ink} />}
            onPress={() => router.push("/send")}
          />
          <StageAction
            label="Scan"
            icon={<ScanLine size={24} color={PAPER.ink} />}
            onPress={() => router.push("/scan")}
          />
          <StageAction
            label="Pay link"
            icon={<Link2 size={24} color={PAPER.ink} />}
            onPress={() => router.push("/links/new")}
          />
        </View>
      </Stage>

      {profileError ? <Problem text="Couldn't load your balance. Pull to retry." /> : null}

      {due.data ? (
        <Animated.View entering={FadeInDown.duration(320)}>
          <StoryTile
            field="kin"
            icon={<Banknote size={24} color={PAPER.ink} />}
            title="Payroll due"
            line={`${paydayWord(due.data.payday)} · ${usd(due.data.total)} to ${due.data.people} ${due.data.people === 1 ? "person" : "people"}`}
            action="Review"
            onPress={() => router.push("/payroll")}
          />
        </Animated.View>
      ) : null}

      {sandbox ? (
        <StoryTile
          field="matcha"
          icon={
            grantStatus.data?.status === "sent" ? (
              <Check size={24} color={PAPER.ink} />
            ) : (
              <Plus size={24} color={PAPER.ink} />
            )
          }
          title={
            grantStatus.data?.status === "sent"
              ? "Test dollars added"
              : testDollars.isPending || grantStatus.data?.status === "queued"
                ? "Sending test dollars…"
                : "Add test dollars"
          }
          line={
            testDollars.error instanceof ApiError
              ? testDollars.error.message
              : grantStatus.data?.status === "failed"
                ? "That didn't go through. Try again tomorrow."
                : "$5.00 of test USDC, once a day."
          }
          action={grant ? undefined : "Add"}
          onPress={grant || testDollars.isPending ? undefined : () => testDollars.mutate()}
        />
      ) : null}

      <SectionTitle
        title="Latest"
        action="All activity"
        onAction={() => router.push("/activity")}
      />
      {activity.isPending ? (
        <Card style={{ padding: 12, gap: 14 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Skeleton width={40} height={40} radius={20} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="60%" height={14} />
                <Skeleton width="35%" height={12} />
              </View>
              <Skeleton width={64} height={16} />
            </View>
          ))}
        </Card>
      ) : activity.isError ? (
        <Problem
          text="Couldn't load your activity. Your balance above is live."
          action="Retry"
          onAction={() => void activity.refetch()}
        />
      ) : activity.data && activity.data.length > 0 ? (
        <Card>
          {activity.data.map((item, i) => (
            <Animated.View key={item.id} entering={FadeInDown.delay(i * 40).duration(320)}>
              <ActivityRow item={item} />
            </Animated.View>
          ))}
        </Card>
      ) : (
        <StoryTile
          field="sora"
          icon={<ArrowDownLeft size={24} color={PAPER.ink} />}
          title="Nothing has moved yet"
          line="Share your pay address or a pay link."
          action="Get paid"
          onPress={() => router.push("/get-paid")}
        />
      )}
      <View
        style={{
          alignItems: "center",
          flexDirection: "row",
          justifyContent: "center",
          gap: 6,
          opacity: 0.8,
        }}
      >
        <Mark id="near" size={14} />
        <T role="meta" tone="text3">
          Settled on NEAR · fees paid by Tegata
        </T>
      </View>
    </Screen>
  )
}
