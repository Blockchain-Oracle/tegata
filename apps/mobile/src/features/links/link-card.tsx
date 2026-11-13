// A pay link as an object on the stage: its title, amount, the QR of its page and the address in mono, with Share
// (the system share sheet carries the URL) and Copy. The business seal presses on when it is first shown.
import * as Clipboard from "expo-clipboard"
import { Check, Copy, Share2 } from "lucide-react-native"
import { useState } from "react"
import { Share, View } from "react-native"

import { webUrl } from "@/api/client"
import type { PayLink } from "@/api/types"
import { fire } from "@/feedback/fire"
import { usd } from "@/lib/money"
import { RADIUS } from "@/theme/tokens"
import { Button } from "@/ui/button"
import { SandboxPill } from "@/ui/layout"
import { Mark } from "@/ui/mark"
import { Qr } from "@/ui/qr"
import { BusinessSeal } from "@/ui/seal"
import { SealPress } from "@/ui/seal-press"
import { Paper, Stage, StageObject } from "@/ui/stage"
import { Figure } from "@/ui/figure"
import { T } from "@/ui/text"

export function linkStatus(link: PayLink): { label: string; tone: "up" | "quiet" | "seal" } {
  if (link.status === "paid") return { label: "Paid", tone: "up" }
  if (link.status === "closed") return { label: "Closed", tone: "quiet" }
  return { label: "Open", tone: "seal" }
}

export const linkUrl = (link: Pick<PayLink, "token">) => webUrl(`/pay/${link.token}`)

export function LinkCard({ link, business, fresh }: { link: PayLink; business: string; fresh?: boolean }) {
  const [copied, setCopied] = useState(false)
  const url = linkUrl(link)
  const share = () => {
    fire("press", { cue: "sheetOpen" })
    void Share.share({ message: `${link.title} · pay ${business}${link.amount ? ` ${usd(link.amount)}` : ""}: ${url}`, url })
  }
  return (
    <Stage style={{ padding: 20, paddingTop: 28, paddingBottom: 24, gap: 18, alignItems: "center" }}>
      <StageObject from={{ y: 24, rotate: -2 }}>
        <Paper style={{ width: 300, padding: 18, gap: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <T role="detailMedium" color="#666">
              Pay link
            </T>
            {link.network === "testnet" ? <SandboxPill label="Sandbox" /> : null}
          </View>
          <T role="rowTitle" color="#000" numberOfLines={2}>
            {link.title}
          </T>
          {link.amount ? (
            <Figure units={link.amount} size={44} color="#000" />
          ) : (
            <T role="price" color="#000">
              Any amount
            </T>
          )}
          <View style={{ alignItems: "center", paddingVertical: 4 }}>
            <Qr value={url} size={196} />
          </View>
          <View style={{ backgroundColor: "#F0F0F0", borderRadius: RADIUS.button, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Mark id="usdc" chain="near" size={18} />
            <T role="mono" color="#000" numberOfLines={1} style={{ flex: 1, fontSize: 13 }}>
              {url.replace(/^https?:\/\//, "")}
            </T>
          </View>
          <View style={{ position: "absolute", right: -22, top: -26 }}>
            <SealPress play={Boolean(fresh)} delay={350} identity={fresh ? `link-${link.id}` : undefined}>
              <BusinessSeal name={business} size={76} />
            </SealPress>
          </View>
        </Paper>
      </StageObject>
      <View style={{ flexDirection: "row", gap: 10, alignSelf: "stretch" }}>
        <Button
          style={{ flex: 1 }}
          variant="white"
          label={copied ? "Copied" : "Copy"}
          icon={copied ? <Check size={20} color="#2F7A00" /> : <Copy size={20} color="#000" />}
          cue={null}
          onPress={async () => {
            await Clipboard.setStringAsync(url)
            fire("tick", { cue: "confirmed" })
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          }}
        />
        <Button style={{ flex: 1 }} label="Share" icon={<Share2 size={20} color="#fff" />} onPress={share} cue={null} />
      </View>
    </Stage>
  )
}
