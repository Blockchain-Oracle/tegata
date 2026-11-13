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

export function Mark({ id, chain, size = 24 }: { id: string; chain?: string; size?: number }) {
  const p = usePalette()
  const source = MARKS[isMark(id) ? id : "unknown"]
  const badge = chain && chain !== id ? MARKS[isMark(chain) ? chain : "unknown"] : null
  const b = Math.round(size * 0.48)
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityLabel={chain ? `${id} on ${chain}` : id}
    >
      <Image source={source} style={{ width: size, height: size }} contentFit="contain" />
      {badge ? (
        <View
          style={{
            position: "absolute",
            right: -b * 0.2,
            bottom: -b * 0.2,
            width: b + 3,
            height: b + 3,
            borderRadius: b,
            backgroundColor: p.card,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Image source={badge} style={{ width: b, height: b }} contentFit="contain" />
        </View>
      ) : null}
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
