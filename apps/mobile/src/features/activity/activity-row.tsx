// One money movement as a row (Family's activity pattern): the coin it moved in (USDC on NEAR, or the coin and chain a
// payment came from) with a ↓/↑ badge, who it was with, what and when, and the amount with its sign. Opens the receipt.
import { router } from "expo-router"
import { ArrowDownLeft, ArrowUpRight } from "lucide-react-native"
import { View } from "react-native"

import type { ActivityItem } from "@/api/types"
import { usd } from "@/lib/money"
import { usePalette } from "@/theme/tokens"
import { Chip, Row } from "@/ui/layout"
import { assetMarks, Mark } from "@/ui/mark"
import { T } from "@/ui/text"

const IN_KINDS = new Set(["received", "reward", "payslip"])
const SETTLED = new Set(["success", "succeeded"])
const FAILED = new Set(["failed", "expired", "refunded"])

export const isIn = (item: ActivityItem) => IN_KINDS.has(item.kind)

const KIND_LABEL: Record<ActivityItem["kind"], string> = {
  send: "Sent",
  paid: "Paid a link",
  received: "Received",
  reward: "Referral reward",
  payroll: "Payroll",
  payslip: "Pay received",
}

export const timeOf = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })

export function statusChip(status: string): { label: string; tone: "warn" | "down" } | null {
  if (SETTLED.has(status)) return null
  if (FAILED.has(status)) return { label: status === "refunded" ? "Refunded" : "Didn't go through", tone: "down" }
  return { label: "Settling", tone: "warn" }
}

export function ActivityRow({ item }: { item: ActivityItem }) {
  const p = usePalette()
  const incoming = isIn(item)
  const { coin, chain } = assetMarks(item.assetIn)
  const chip = statusChip(item.status)
  const account = /\.(near|testnet)$|^[0-9a-f]{64}$/.test(item.counterparty)
  return (
    <Row
      onPress={() =>
        router.push({ pathname: "/receipt", params: { item: JSON.stringify(item) } })
      }
      mono={account}
      left={
        <View>
          <Mark id={coin} chain={chain} size={40} />
          <View
            style={{
              position: "absolute",
              left: -4,
              top: -4,
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: incoming ? p.up : p.ink,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: p.card,
            }}
          >
            {incoming ? <ArrowDownLeft size={11} color={p.card} strokeWidth={3} /> : <ArrowUpRight size={11} color={p.card} strokeWidth={3} />}
          </View>
        </View>
      }
      title={item.counterparty}
      meta={
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <T role="detail" tone="text2" numberOfLines={1} style={{ flexShrink: 1 }}>
            {item.title ?? KIND_LABEL[item.kind]} · {timeOf(item.at)}
          </T>
          {chip ? <Chip label={chip.label} tone={chip.tone} /> : null}
        </View>
      }
      right={
        <T role="rowTitle" tone={incoming ? "up" : "ink"} style={{ fontVariant: ["tabular-nums"] }}>
          {incoming ? usd(item.amount, { signed: true }) : `−${usd(item.amount)}`}
        </T>
      }
    />
  )
}
