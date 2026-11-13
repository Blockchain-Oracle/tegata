// M5 Pay links: every link with what it has brought in, newest first; "New link" on top. Each opens its detail.
import { useQuery } from "@tanstack/react-query"
import { router } from "expo-router"
import { Link2, Plus } from "lucide-react-native"
import { View } from "react-native"
import Animated, { FadeInDown } from "react-native-reanimated"

import { api } from "@/api/client"
import type { PayLink } from "@/api/types"
import { useSession } from "@/auth/session"
import { linkStatus } from "@/features/links/link-card"
import { usd } from "@/lib/money"
import { PAPER, usePalette } from "@/theme/tokens"
import { Button } from "@/ui/button"
import { Card, Chip, Header, Problem, Row, Screen, StoryTile } from "@/ui/layout"
import { MarkStack } from "@/ui/mark"
import { Skeleton } from "@/ui/shimmer"
import { T } from "@/ui/text"

export default function Links() {
  const p = usePalette()
  const { network } = useSession()
  const links = useQuery({
    queryKey: ["links", network],
    queryFn: () => api<{ links: PayLink[] }>("/api/links"),
    select: (data) => data.links.filter((link) => link.network === network),
  })
  return (
    <Screen dock onRefresh={() => links.refetch()}>
      <Header title="Pay links" back={false} />
      <View style={{ backgroundColor: p.sora, borderRadius: 20, padding: 16, gap: 12 }}>
        <T role="rowTitle" color={p.fieldInk}>
          Payers use any coin on any chain
        </T>
        <MarkStack
          ids={["eth", "base", "sol", "btc", "tron", "arb", "bnb", "pol"]}
          size={30}
          ring={p.sora}
        />
        <T role="detailMedium" color={`${p.fieldInk}B3`}>
          You get exact dollars as USDC on NEAR
        </T>
      </View>
      <Button
        label="New pay link"
        icon={<Plus size={20} color={p.onPrimary} />}
        onPress={() => router.push("/links/new")}
      />
      {links.isPending ? (
        <Card style={{ padding: 12, gap: 16 }}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={{ gap: 6 }}>
              <Skeleton width="50%" height={16} />
              <Skeleton width="30%" height={12} />
            </View>
          ))}
        </Card>
      ) : links.isError ? (
        <Problem
          text="Couldn't load your links."
          action="Retry"
          onAction={() => void links.refetch()}
        />
      ) : (links.data ?? []).length === 0 ? (
        <StoryTile
          field="sora"
          icon={<Link2 size={24} color={PAPER.ink} />}
          title="Your first pay link"
          line="Anyone pays it from any chain; you get dollars."
          action="New link"
          onPress={() => router.push("/links/new")}
        />
      ) : (
        <Card>
          {(links.data ?? []).map((link, i) => {
            const status = linkStatus(link)
            return (
              <Animated.View key={link.id} entering={FadeInDown.delay(i * 40).duration(320)}>
                <Row
                  chevron
                  onPress={() => router.push({ pathname: "/links/[id]", params: { id: link.id } })}
                  left={
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 20,
                        backgroundColor: p.sealWash,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Link2 size={20} color={p.sealInk} />
                    </View>
                  }
                  title={link.title}
                  meta={
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <T role="detail" tone="text2">
                        {link.amount ? usd(link.amount) : "Any amount"}
                        {link.paidCount > 0 ? ` · ${usd(link.paidTotal)} in` : ""}
                      </T>
                      <Chip label={status.label} tone={status.tone} />
                    </View>
                  }
                />
              </Animated.View>
            )
          })}
        </Card>
      )}
    </Screen>
  )
}
