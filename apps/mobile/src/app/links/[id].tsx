// A pay link: the link object on the stage (share, copy, QR), then every payment made to it with the coin-and-chain
// marks of what was paid, each opening its receipt.
import { useQuery } from "@tanstack/react-query"
import { router, useLocalSearchParams } from "expo-router"
import { View } from "react-native"

import { api } from "@/api/client"
import type { LinkDetail } from "@/api/types"
import { useSession } from "@/auth/session"
import { LinkCard } from "@/features/links/link-card"
import { statusChip, timeOf } from "@/features/activity/activity-row"
import { usd } from "@/lib/money"
import { Card, Chip, Header, Problem, Row, Screen, SectionTitle } from "@/ui/layout"
import { assetMarks, Mark } from "@/ui/mark"
import { Skeleton } from "@/ui/shimmer"
import { T } from "@/ui/text"

export default function LinkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const { profile } = useSession()
  const detail = useQuery({
    queryKey: ["link", id],
    queryFn: () => api<LinkDetail>(`/api/links/${id}`),
    refetchInterval: 5000,
  })
  const business = profile?.workspace?.name ?? "Your business"
  const link = detail.data?.request
  return (
    <Screen refreshing={detail.isRefetching} onRefresh={() => void detail.refetch()}>
      <Header title={link?.title ?? "Pay link"} />
      {detail.isError ? (
        <Problem text="Couldn't load the link." action="Retry" onAction={() => void detail.refetch()} />
      ) : link && detail.data ? (
        <>
          <LinkCard link={link} business={business} />
          <SectionTitle title={detail.data.payments.length ? `Paid ${detail.data.payments.length}×` : "No payments yet"} />
          {detail.data.payments.length > 0 ? (
            <Card>
              {detail.data.payments.map((payment) => {
                const { coin, chain } = assetMarks(payment.assetIn)
                const chip = statusChip(payment.status)
                return (
                  <Row
                    key={payment.id}
                    left={<Mark id={coin} chain={chain} size={40} />}
                    title={payment.payer ?? payment.payerEmail ?? "A payer"}
                    mono={Boolean(payment.payer)}
                    meta={
                      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
                        <T role="detail" tone="text2">
                          {new Date(payment.settledAt ?? payment.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })} ·{" "}
                          {timeOf(payment.settledAt ?? payment.createdAt)}
                        </T>
                        {chip ? <Chip label={chip.label} tone={chip.tone} /> : null}
                      </View>
                    }
                    right={
                      <T role="rowTitle" tone="up">
                        {usd(payment.amount, { signed: true })}
                      </T>
                    }
                    onPress={
                      payment.receiptToken
                        ? () =>
                            router.push({
                              pathname: "/receipt",
                              params: { token: payment.receiptToken ?? "" },
                            })
                        : undefined
                    }
                  />
                )
              })}
            </Card>
          ) : null}
        </>
      ) : (
        <Skeleton width="100%" height={420} radius={24} />
      )}
    </Screen>
  )
}
