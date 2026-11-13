// M7 Activity: every movement in this mode, grouped by day, All · In · Out. Each row opens its receipt.
import { useQuery } from "@tanstack/react-query"
import { router } from "expo-router"
import { ArrowDownLeft } from "lucide-react-native"
import { useMemo, useState } from "react"
import { View } from "react-native"
import Animated, { FadeInDown } from "react-native-reanimated"

import { api } from "@/api/client"
import type { ActivityItem } from "@/api/types"
import { useSession } from "@/auth/session"
import { ActivityRow, isIn } from "@/features/activity/activity-row"
import { PAPER } from "@/theme/tokens"
import { Card, Header, Problem, Screen, StoryTile } from "@/ui/layout"
import { Segmented } from "@/ui/segmented"
import { Skeleton } from "@/ui/shimmer"
import { T } from "@/ui/text"

type Filter = "all" | "in" | "out"

function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return "Today"
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday"
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: d.getFullYear() === today.getFullYear() ? undefined : "numeric",
  })
}

export default function Activity() {
  const { network } = useSession()
  const [filter, setFilter] = useState<Filter>("all")
  const activity = useQuery({
    queryKey: ["activity", network],
    queryFn: () => api<{ items: ActivityItem[] }>("/api/activity"),
    select: (data) => data.items.filter((item) => item.network === network),
  })
  const groups = useMemo(() => {
    const items = (activity.data ?? []).filter((item) =>
      filter === "all" ? true : filter === "in" ? isIn(item) : !isIn(item),
    )
    const map = new Map<string, ActivityItem[]>()
    for (const item of items) {
      const key = dayLabel(item.at)
      map.set(key, [...(map.get(key) ?? []), item])
    }
    return [...map.entries()]
  }, [activity.data, filter])

  return (
    <Screen dock refreshing={activity.isRefetching} onRefresh={() => void activity.refetch()}>
      <Header title="Activity" back={false} />
      <Segmented
        options={[
          { value: "all", label: "All" },
          { value: "in", label: "In" },
          { value: "out", label: "Out" },
        ]}
        value={filter}
        onChange={setFilter}
      />
      {activity.isPending ? (
        <Card style={{ padding: 12, gap: 16 }}>
          {[0, 1, 2, 3].map((i) => (
            <View key={i} style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <Skeleton width={40} height={40} radius={20} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="55%" height={14} />
                <Skeleton width="30%" height={12} />
              </View>
            </View>
          ))}
        </Card>
      ) : activity.isError ? (
        <Problem
          text="Couldn't load your activity."
          action="Retry"
          onAction={() => void activity.refetch()}
        />
      ) : groups.length === 0 ? (
        <StoryTile
          field="sora"
          icon={<ArrowDownLeft size={24} color={PAPER.ink} />}
          title={
            filter === "all"
              ? "Nothing has moved yet"
              : filter === "in"
                ? "No money in yet"
                : "No money out yet"
          }
          line="Share your pay address or a pay link."
          action="Get paid"
          onPress={() => router.push("/get-paid")}
        />
      ) : (
        groups.map(([day, items], g) => (
          <Animated.View
            key={day}
            entering={FadeInDown.delay(g * 40).duration(320)}
            style={{ gap: 10 }}
          >
            <T role="sectionTitle">{day}</T>
            <Card>
              {items.map((item) => (
                <ActivityRow key={`${item.kind}-${item.id}`} item={item} />
              ))}
            </Card>
          </Animated.View>
        ))
      )}
    </Screen>
  )
}
