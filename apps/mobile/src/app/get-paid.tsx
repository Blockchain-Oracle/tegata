// M4 Get paid (a native form sheet): the pay address as a QR on white paper with the business seal at its corner, the
// account in mono with the NEAR mark, "USDC on NEAR", Copy and Share (the system share sheet), and a pay link below.
import * as Clipboard from "expo-clipboard"
import { router } from "expo-router"
import { Check, Copy, Link2, Share2 } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Share, View } from "react-native"

import { useSession } from "@/auth/session"
import { fire } from "@/feedback/fire"
import { PAPER, SHADOW, usePalette } from "@/theme/tokens"
import { Button } from "@/ui/button"
import { Row, SandboxPill } from "@/ui/layout"
import { Mark } from "@/ui/mark"
import { Qr } from "@/ui/qr"
import { BusinessSeal } from "@/ui/seal"
import { SealPress } from "@/ui/seal-press"
import { Skeleton } from "@/ui/shimmer"
import { T } from "@/ui/text"

export default function GetPaid() {
  const p = usePalette()
  const { account, profile, network } = useSession()
  const [copied, setCopied] = useState(false)
  const name = profile?.workspace?.name ?? "Your business"
  useEffect(() => {
    fire("tick", { cue: "sheetOpen" })
  }, [])

  const copy = async () => {
    if (!account) return
    await Clipboard.setStringAsync(account.accountId)
    fire("tick", { cue: "confirmed" })
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.page, padding: 20, paddingTop: 28, gap: 22 }}>
      <T role="sheetTitle">Get paid</T>
      <View style={{ alignItems: "center", gap: 18 }}>
        <View
          style={[{ backgroundColor: PAPER.face, borderRadius: 24, padding: 18 }, SHADOW.receipt]}
        >
          {account ? (
            <Qr value={`near:${account.accountId}`} size={232} />
          ) : (
            <Skeleton width={232} height={232} />
          )}
          <View style={{ position: "absolute", right: -30, top: -30 }}>
            <SealPress delay={200} identity={`get-paid-${account?.accountId}`} cue={null}>
              <BusinessSeal name={name} size={80} />
            </SealPress>
          </View>
        </View>
        <View style={{ alignItems: "center", gap: 8 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Mark id="near" size={22} />
            <T
              role="mono"
              style={{ fontSize: 15, flexShrink: 1 }}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {account?.accountId ?? " "}
            </T>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Mark id="usdc" chain="near" size={18} />
            <T role="detail" tone="text2">
              USDC on NEAR
            </T>
          </View>
          {network === "testnet" ? (
            <View style={{ alignSelf: "center" }}>
              <SandboxPill />
            </View>
          ) : null}
        </View>
      </View>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button
          style={{ flex: 1 }}
          variant="secondary"
          label={copied ? "Copied" : "Copy"}
          icon={copied ? <Check size={20} color={p.up} /> : <Copy size={20} color={p.ink} />}
          onPress={copy}
          cue={null}
        />
        <Button
          style={{ flex: 1 }}
          label="Share"
          icon={<Share2 size={20} color={p.onPrimary} />}
          onPress={() => {
            if (!account) return
            void Share.share({ message: `Pay ${name} in USDC on NEAR: ${account.accountId}` })
          }}
        />
      </View>
      <View style={{ backgroundColor: p.card, borderRadius: 20, padding: 4 }}>
        <Row
          chevron
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
          title="Make a pay link"
          meta="Payers use any coin on any chain"
          onPress={() => {
            router.back()
            setTimeout(() => router.push("/links/new"), 250)
          }}
        />
      </View>
    </View>
  )
}
