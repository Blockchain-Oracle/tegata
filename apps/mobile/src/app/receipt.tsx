// M8 Receipt. From Activity it opens with the movement itself; from a pay link's payment, with its public receipt
// token (the API's `/api/receipts/<token>`, which also gives the NEAR transaction). The full public page and sharing
// use tegata.xyz, so a customer or an accountant sees the same receipt.
import { useQuery } from "@tanstack/react-query"
import { useLocalSearchParams } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { ExternalLink, Share2 } from "lucide-react-native"
import { Share, View } from "react-native"

import { api, webUrl } from "@/api/client"
import type { ActivityItem, PaymentReceipt } from "@/api/types"
import { useSession } from "@/auth/session"
import { isIn } from "@/features/activity/activity-row"
import { ReceiptSlip } from "@/features/receipt/receipt-slip"
import { usePalette } from "@/theme/tokens"
import { Button } from "@/ui/button"
import { Header, Problem, Screen } from "@/ui/layout"
import { Mark } from "@/ui/mark"
import { Skeleton } from "@/ui/shimmer"

const HOW: Record<string, string> = {
  send: "Send on NEAR",
  paid: "Paid a pay link",
  received: "Pay link",
  reward: "Referral reward",
  payroll: "Payroll run",
  payslip: "Pay received",
  tegata: "From a Tegata balance",
  near_wallet: "From a NEAR wallet",
  oneclick: "From another chain · NEAR Intents",
  manual: "Marked paid by hand",
  card: "By card",
}
const SETTLED = new Set(["success", "succeeded"])

export default function Receipt() {
  const p = usePalette()
  const params = useLocalSearchParams<{ item?: string; token?: string }>()
  const { profile } = useSession()
  const item = params.item ? (JSON.parse(params.item) as ActivityItem) : null
  const token = params.token ?? (item?.receiptUrl?.startsWith("/r/") && !item.receiptUrl.slice(3).includes("/") ? item.receiptUrl.slice(3) : null)
  const payment = useQuery({
    queryKey: ["receipt", token],
    queryFn: () => api<PaymentReceipt>(`/api/receipts/${token}`, { auth: false }),
    enabled: Boolean(token),
  })
  const business = profile?.workspace?.name ?? "Your business"
  const publicUrl = item?.receiptUrl ? webUrl(item.receiptUrl) : token ? webUrl(`/r/${token}`) : null

  const actions = (explorer: string | null) => (
    <View style={{ gap: 10 }}>
      {explorer ? (
        <Button variant="secondary" label="Open on NEAR" icon={<Mark id="near" size={20} />} onPress={() => void WebBrowser.openBrowserAsync(explorer)} />
      ) : null}
      {publicUrl ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          <Button
            style={{ flex: 1 }}
            variant="secondary"
            label="Full receipt"
            icon={<ExternalLink size={18} color={p.ink} />}
            onPress={() => void WebBrowser.openBrowserAsync(publicUrl)}
          />
          <Button
            style={{ flex: 1 }}
            label="Share"
            icon={<Share2 size={18} color={p.onPrimary} />}
            onPress={() => void Share.share({ message: publicUrl, url: publicUrl })}
          />
        </View>
      ) : null}
    </View>
  )

  if (token && payment.isPending) return (
    <Screen>
      <Header title="Receipt" />
      <Skeleton width={340} height={420} radius={20} style={{ alignSelf: "center" }} />
    </Screen>
  )

  if (token && payment.data) {
    const r = payment.data
    return (
      <Screen>
        <Header title="Receipt" />
        <ReceiptSlip
          business={r.business}
          heading={r.number ? `Receipt · No. ${String(r.number).padStart(4, "0")}` : "Receipt"}
          title={r.title}
          amount={r.amount}
          incoming
          settledAt={r.settledAt}
          identity={token}
          rows={[
            ["Date", new Date(r.settledAt ?? Date.now()).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })],
            ["From", r.payer ?? "A payer"],
            ["To", r.receiverId],
            ["How", HOW[r.rail] ?? "Pay link"],
            ["Network fee", r.rail === "tegata" ? "Paid by Tegata" : "Paid by the payer"],
          ]}
        />
        {actions(r.explorerUrl)}
      </Screen>
    )
  }

  if (!item)
    return (
      <Screen>
        <Header title="Receipt" />
        <Problem text="This receipt couldn't be opened." />
      </Screen>
    )

  const incoming = isIn(item)
  return (
    <Screen>
      <Header title="Receipt" />
      <ReceiptSlip
        business={business}
        heading={HOW[item.kind] ?? "Receipt"}
        title={item.title ?? (incoming ? `From ${item.counterparty}` : `To ${item.counterparty}`)}
        amount={item.amount}
        incoming={incoming}
        settledAt={SETTLED.has(item.status) ? item.at : null}
        identity={`${item.kind}-${item.id}`}
        rows={[
          ["Date", new Date(item.at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })],
          [incoming ? "From" : "To", item.counterparty],
          ["How", item.rail ? (HOW[item.rail] ?? HOW[item.kind] ?? "") : (HOW[item.kind] ?? "")],
          ["Network fee", "Paid by Tegata"],
        ]}
      />
      {actions(null)}
    </Screen>
  )
}
