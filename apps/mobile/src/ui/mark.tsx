// Real marks for coins, chains and partners, in their own colours (never tinted, never a letter disc), and round flags.
// The files are the web's own (apps/web/public/marks, flags; provenance in assets/marks/PROVENANCE.md), drawn by
// expo-image. `chain` adds the chain's mark as a small badge: USDC on NEAR is the USDC mark with NEAR at its foot.
import { Image } from "expo-image"
import { View } from "react-native"

import { usePalette } from "@/theme/tokens"

const MARKS = {
  usdc: require("../../assets/marks/usdc.svg"),
  usdt: require("../../assets/marks/usdt.svg"),
  near: require("../../assets/marks/near.svg"),
  eth: require("../../assets/marks/eth.svg"),
  sol: require("../../assets/marks/sol.svg"),
  btc: require("../../assets/marks/btc.svg"),
  base: require("../../assets/marks/base.svg"),
  arb: require("../../assets/marks/arb.svg"),
  op: require("../../assets/marks/op.svg"),
  pol: require("../../assets/marks/pol.svg"),
  bnb: require("../../assets/marks/bnb.svg"),
  tron: require("../../assets/marks/tron.svg"),
  ton: require("../../assets/marks/ton.svg"),
  sui: require("../../assets/marks/sui.svg"),
  avax: require("../../assets/marks/avax.svg"),
  gnosis: require("../../assets/marks/gnosis.svg"),
  stellar: require("../../assets/marks/stellar.svg"),
  xrp: require("../../assets/marks/xrp.svg"),
  doge: require("../../assets/marks/doge.svg"),
  ltc: require("../../assets/marks/ltc.svg"),
  zec: require("../../assets/marks/zec.svg"),
  dai: require("../../assets/marks/dai.svg"),
  wbtc: require("../../assets/marks/wbtc.svg"),
  ada: require("../../assets/marks/ada.svg"),
  aurora: require("../../assets/marks/aurora.svg"),
  bera: require("../../assets/marks/bera.svg"),
  mon: require("../../assets/marks/mon.svg"),
  intents: require("../../assets/marks/intents.svg"),
  circle: require("../../assets/marks/circle.svg"),
  unknown: require("../../assets/marks/unknown.svg"),
} as const

export type MarkId = keyof typeof MARKS

export const isMark = (id: string): id is MarkId => id in MARKS

const FLAGS = {
  us: require("../../assets/flags/us.svg"),
  gb: require("../../assets/flags/gb.svg"),
  eu: require("../../assets/flags/eu.svg"),
  ng: require("../../assets/flags/ng.svg"),
  gh: require("../../assets/flags/gh.svg"),
  ke: require("../../assets/flags/ke.svg"),
  za: require("../../assets/flags/za.svg"),
} as const

/** Marks drawn edge to edge in a square need a rounded-square crop; the rest are cropped round (as on the web). */
const SQUARE: ReadonlySet<string> = new Set(["near", "intents", "google", "circle"])
const crop = (id: string, size: number) => (SQUARE.has(id) ? size * 0.28 : size / 2)

export function Mark({ id, chain, size = 24 }: { id: string; chain?: string; size?: number }) {
  const p = usePalette()
  const known = isMark(id) ? id : "unknown"
  const badge = chain && chain !== id ? (isMark(chain) ? chain : "unknown") : null
  const b = Math.round(size * 0.44)
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={chain ? `${id} on ${chain}` : id}
    >
      <View
        style={{ width: size, height: size, borderRadius: crop(known, size), overflow: "hidden" }}
      >
        <Image source={MARKS[known]} style={{ width: size, height: size }} contentFit="cover" />
      </View>
      {badge ? (
        <View
          style={{
            position: "absolute",
            right: -2,
            bottom: -2,
            width: b + 4,
            height: b + 4,
            borderRadius: crop(badge, b + 4),
            backgroundColor: p.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <View style={{ width: b, height: b, borderRadius: crop(badge, b), overflow: "hidden" }}>
            <Image source={MARKS[badge]} style={{ width: b, height: b }} contentFit="cover" />
          </View>
        </View>
      ) : null}
    </View>
  )
}

/** Overlapping marks ("pay from any of these"), each over the last, ringed in the surface colour. */
export function MarkStack({
  ids,
  size = 28,
  ring,
}: {
  ids: readonly string[]
  size?: number
  ring?: string
}) {
  const p = usePalette()
  return (
    <View style={{ flexDirection: "row", alignItems: "center" }}>
      {ids.map((id, i) => (
        <View
          key={id}
          style={{
            marginLeft: i === 0 ? 0 : -size * 0.28,
            padding: 2,
            borderRadius: crop(id, size + 4),
            backgroundColor: ring ?? p.card,
          }}
        >
          <Mark id={id} size={size} />
        </View>
      ))}
    </View>
  )
}

export function Flag({ code, size = 20 }: { code: keyof typeof FLAGS; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden" }}>
      <Image source={FLAGS[code]} style={{ width: size, height: size }} contentFit="cover" />
    </View>
  )
}

/**
 * A 1Click asset id ("nep141:eth-0x…omft.near", "nep141:sol.omft.near") → the coin and chain marks it was paid in.
 * Mirrors the web's reading of `assetIn`; anything unknown falls back to USDC on NEAR.
 */
export function assetMarks(assetIn: string | null | undefined): { coin: string; chain: string } {
  if (!assetIn) return { coin: "usdc", chain: "near" }
  const text = assetIn.toLowerCase()
  const chain =
    [
      "eth",
      "base",
      "arb",
      "sol",
      "btc",
      "tron",
      "pol",
      "bnb",
      "op",
      "avax",
      "ton",
      "sui",
      "gnosis",
      "xrp",
      "doge",
      "zec",
      "ltc",
      "stellar",
    ].find(
      (c) => text.includes(`${c}-`) || text.includes(`${c}.omft`) || text.startsWith(`nep141:${c}`),
    ) ?? "near"
  const coin = text.includes("usdt")
    ? "usdt"
    : text.includes("usdc") || text.includes("0xa0b8")
      ? "usdc"
      : chain
  return { coin, chain }
}
