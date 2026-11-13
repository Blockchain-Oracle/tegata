// M8 The receipt: a white paper slip (receipt shadow, a scalloped foot like torn paper) with the business seal and name,
// what it was for, the amount with its sign, the facts as rows, and the round business seal stamped "PAID · <date>"
// pressing on once the money has settled (once per receipt, with `stamp`). Unsettled: the band waits.
import type { ReactNode } from "react"
import { View } from "react-native"
import Animated, { FadeInUp } from "react-native-reanimated"
import Svg, { Path } from "react-native-svg"

import { PAPER, usePalette } from "@/theme/tokens"
import { Figure } from "@/ui/figure"
import { BusinessSeal } from "@/ui/seal"
import { SealPress } from "@/ui/seal-press"
import { T } from "@/ui/text"

function ScallopedFoot({ width }: { width: number }) {
  const r = 7
  const n = Math.max(1, Math.floor(width / (r * 2)))
  const w = width / n
  let d = `M0 0 H${width} V${r}`
  for (let i = n; i > 0; i--) {
    const x = i * w
    d += ` A${w / 2} ${r} 0 0 1 ${x - w} ${r}`
  }
  d += " Z"
  return (
    <Svg width={width} height={r * 2} style={{ marginTop: -1 }}>
      <Path d={d} fill={PAPER.face} />
    </Svg>
  )
}

export function ReceiptSlip({
  business,
  heading,
  title,
  amount,
  incoming,
  rows,
  settledAt,
  identity,
  footer,
  width = 340,
}: {
  business: string
  /** "Receipt · No. 0042", "Sent", "Payslip". */
  heading: string
  title: string
  /** USDC base units. */
  amount: string
  incoming: boolean
  rows: [string, ReactNode][]
  /** When NEAR settled it; null while it hasn't. */
  settledAt: string | null
  identity: string
  footer?: ReactNode
  width?: number
}) {
  const p = usePalette()
  const band = settledAt
    ? `Paid · ${new Date(settledAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`
    : undefined
  return (
    <Animated.View
      entering={FadeInUp.duration(420).springify().damping(30)}
      style={{ alignSelf: "center", width }}
    >
      <View
        style={{
          backgroundColor: PAPER.face,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          padding: 20,
          paddingBottom: 26,
          gap: 14,
          shadowColor: PAPER.ink,
          shadowOpacity: 0.2,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 8 },
          elevation: 6,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <BusinessSeal name={business} size={36} tilt={0} />
          <View style={{ flex: 1 }}>
            <T role="rowTitle" color={PAPER.ink} numberOfLines={1}>
              {business}
            </T>
            <T role="meta" color={PAPER.text2}>
              {heading}
            </T>
          </View>
        </View>
        <View
          style={{ height: 1, borderStyle: "dashed", borderWidth: 0.5, borderColor: PAPER.rule }}
        />
        <View style={{ gap: 4 }}>
          <T role="bodyMedium" color={PAPER.text2} numberOfLines={2}>
            {title}
          </T>
          <Figure
            units={incoming ? amount : `-${amount}`}
            size={50}
            color={incoming ? PAPER.up : PAPER.ink}
            signed={incoming}
          />
        </View>
        <View style={{ gap: 10 }}>
          {rows.map(([label, value]) => (
            <View
              key={label}
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
              }}
            >
              <T role="detail" color={PAPER.text2}>
                {label}
              </T>
              {typeof value === "string" ? (
                <T
                  role="detailMedium"
                  color={PAPER.ink}
                  numberOfLines={1}
                  style={{ flexShrink: 1, textAlign: "right" }}
                >
                  {value}
                </T>
              ) : (
                value
              )}
            </View>
          ))}
        </View>
        {footer}
        <View style={{ position: "absolute", right: 14, bottom: 6 }} pointerEvents="none">
          {band ? (
            <SealPress delay={420} identity={`receipt-${identity}`}>
              <BusinessSeal
                name={business}
                band={band.replace("Paid · ", "PAID ")}
                size={96}
                tilt={-8}
              />
            </SealPress>
          ) : (
            <View style={{ opacity: 0.25 }}>
              <BusinessSeal name={business} band="Sending" size={96} tilt={-8} color={p.text3} />
            </View>
          )}
        </View>
      </View>
      <ScallopedFoot width={width} />
    </Animated.View>
  )
}
