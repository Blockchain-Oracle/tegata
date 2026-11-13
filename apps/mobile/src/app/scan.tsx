// M10 Scan to pay: full-bleed camera, a rounded frame with white corner brackets, Close and torch on top, one pill
// under the frame. A NEAR account turns the frame vermilion and offers "Pay <account>" (→ Send, filled in); a Tegata
// link (pay page, invoice, receipt) opens in the in-app browser; anything else is said in the pill.
import { CameraView, useCameraPermissions } from "expo-camera"
import { router } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { Flashlight, X } from "lucide-react-native"
import { useEffect, useRef, useState } from "react"
import { Linking, View } from "react-native"
import Animated, { FadeInDown } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { fire } from "@/feedback/fire"
import { LACQUER, ON_STAGE, PAPER, RADIUS, SHU } from "@/theme/tokens"
import { Button } from "@/ui/button"
import { Mark } from "@/ui/mark"
import { Press } from "@/ui/press"
import { StageField } from "@/ui/stage"
import { T } from "@/ui/text"

const FRAME = 260
const NEAR_ACCOUNT =
  /^(?=.{2,64}$)(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+\.(near|testnet)$/
const IMPLICIT = /^[0-9a-f]{64}$/
const TEGATA = /^https?:\/\/(www\.)?tegata\.xyz\/(pay|i|r|p|join)\//

type Found =
  | { kind: "near"; accountId: string; amount: string | null }
  | { kind: "tegata"; url: string }
  | { kind: "unknown" }

function readCode(raw: string): Found {
  const text = raw.trim()
  if (TEGATA.test(text)) return { kind: "tegata", url: text }
  const near = text.replace(/^near:/i, "")
  const [account = "", query = ""] = near.split("?")
  const lower = account.toLowerCase()
  if (NEAR_ACCOUNT.test(lower) || IMPLICIT.test(lower)) {
    const amount = new URLSearchParams(query).get("amount")
    return { kind: "near", accountId: lower, amount }
  }
  return { kind: "unknown" }
}

function Corner({ style }: { style: object }) {
  return (
    <View
      style={[
        { position: "absolute", width: 40, height: 40, borderColor: "#FFFFFF", borderWidth: 0 },
        style,
      ]}
    />
  )
}

export default function Scan() {
  const insets = useSafeAreaInsets()
  const [permission, requestPermission] = useCameraPermissions()
  const [asked, setAsked] = useState(false)
  useEffect(() => {
    if (permission && !permission.granted && permission.canAskAgain && !asked)
      void requestPermission().finally(() => setAsked(true))
  }, [permission, asked, requestPermission])
  const [torch, setTorch] = useState(false)
  const [found, setFound] = useState<Found | null>(null)
  const last = useRef("")

  const onScan = (data: string) => {
    if (data === last.current) return
    last.current = data
    const read = readCode(data)
    setFound(read)
    if (read.kind === "unknown") fire("warn")
    else fire("filled", { cue: "confirmed" })
  }

  // First visit: iOS asks with its own prompt; the explainer below shows only after a "no".
  const undecided = !permission || (!permission.granted && permission.canAskAgain && !asked)
  if (undecided) return <View style={{ flex: 1, backgroundColor: LACQUER.base }} />
  if (!permission.granted)
    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          paddingTop: insets.top + 24,
          paddingBottom: insets.bottom + 24,
          justifyContent: "flex-end",
          gap: 16,
        }}
      >
        <StageField tone="lacquer" />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <View style={{ width: 200, height: 200, alignItems: "center", justifyContent: "center" }}>
            {(["tl", "tr", "bl", "br"] as const).map((corner) => (
              <View
                key={corner}
                style={{
                  position: "absolute",
                  width: 44,
                  height: 44,
                  borderColor: ON_STAGE.soft,
                  ...(corner[0] === "t"
                    ? { top: 0, borderTopWidth: 4 }
                    : { bottom: 0, borderBottomWidth: 4 }),
                  ...(corner[1] === "l"
                    ? { left: 0, borderLeftWidth: 4 }
                    : { right: 0, borderRightWidth: 4 }),
                  ...(corner === "tl" ? { borderTopLeftRadius: 22 } : {}),
                  ...(corner === "tr" ? { borderTopRightRadius: 22 } : {}),
                  ...(corner === "bl" ? { borderBottomLeftRadius: 22 } : {}),
                  ...(corner === "br" ? { borderBottomRightRadius: 22 } : {}),
                }}
              />
            ))}
            <Mark id="near" size={56} />
          </View>
        </View>
        <T role="stepTitle" tone="white">
          Scan a Tegata or NEAR code with the camera.
        </T>
        <Button
          variant="white"
          label={permission.canAskAgain ? "Allow the camera" : "Allow it in Settings"}
          onPress={() =>
            permission.canAskAgain ? void requestPermission() : void Linking.openSettings()
          }
        />
        <Button variant="secondary" label="Close" onPress={() => router.back()} />
      </View>
    )

  const frameColor = found?.kind === "near" || found?.kind === "tegata" ? SHU : "#FFFFFF"
  const b = 4
  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        enableTorch={torch}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={(result) => onScan(result.data)}
      />
      <View
        style={{
          position: "absolute",
          top: insets.top + 8,
          left: 16,
          right: 16,
          flexDirection: "row",
          justifyContent: "space-between",
        }}
      >
        <Press
          haptic="tick"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: "#00000080",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={24} color="#fff" />
        </Press>
        <Press
          haptic="tick"
          accessibilityLabel="Torch"
          onPress={() => setTorch((t) => !t)}
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: torch ? "#FFFFFF" : "#00000080",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Flashlight size={22} color={torch ? "#000" : "#fff"} />
        </Press>
      </View>
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          right: 0,
          alignItems: "center",
          justifyContent: "center",
          gap: 20,
        }}
      >
        <View style={{ width: FRAME, height: FRAME }}>
          <Corner
            style={{
              top: 0,
              left: 0,
              borderTopWidth: b,
              borderLeftWidth: b,
              borderTopLeftRadius: 24,
              borderColor: frameColor,
            }}
          />
          <Corner
            style={{
              top: 0,
              right: 0,
              borderTopWidth: b,
              borderRightWidth: b,
              borderTopRightRadius: 24,
              borderColor: frameColor,
            }}
          />
          <Corner
            style={{
              bottom: 0,
              left: 0,
              borderBottomWidth: b,
              borderLeftWidth: b,
              borderBottomLeftRadius: 24,
              borderColor: frameColor,
            }}
          />
          <Corner
            style={{
              bottom: 0,
              right: 0,
              borderBottomWidth: b,
              borderRightWidth: b,
              borderBottomRightRadius: 24,
              borderColor: frameColor,
            }}
          />
        </View>
        <View
          style={{
            backgroundColor: PAPER.face,
            borderRadius: RADIUS.pill,
            paddingHorizontal: 16,
            paddingVertical: 8,
          }}
        >
          <T role="detailMedium" tone="black">
            {found?.kind === "unknown"
              ? "That isn't a Tegata or NEAR code"
              : "Scan a Tegata or NEAR code"}
          </T>
        </View>
      </View>
      {found && found.kind !== "unknown" ? (
        <Animated.View
          entering={FadeInDown.duration(320)}
          style={{
            position: "absolute",
            left: 12,
            right: 12,
            bottom: insets.bottom + 12,
            backgroundColor: PAPER.face,
            borderRadius: RADIUS.sheet,
            padding: 20,
            gap: 14,
          }}
        >
          {found.kind === "near" ? (
            <>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <Mark id="near" size={28} />
                <View style={{ flex: 1 }}>
                  <T role="detail" color={PAPER.text2}>
                    Pay a NEAR account
                  </T>
                  <T role="mono" color={PAPER.ink} numberOfLines={1}>
                    {found.accountId}
                  </T>
                </View>
              </View>
              <Button
                label={`Pay ${found.accountId.length > 22 ? "this account" : found.accountId}`}
                onPress={() =>
                  router.replace({
                    pathname: "/send",
                    params: {
                      to: found.accountId,
                      ...(found.amount ? { amount: found.amount } : {}),
                    },
                  })
                }
              />
            </>
          ) : (
            <>
              <T role="rowTitle" color={PAPER.ink}>
                A Tegata link
              </T>
              <T role="mono" color={PAPER.text2} numberOfLines={1}>
                {found.url.replace(/^https?:\/\//, "")}
              </T>
              <Button label="Open it" onPress={() => void WebBrowser.openBrowserAsync(found.url)} />
            </>
          )}
          <Button
            variant="secondary"
            label="Scan again"
            onPress={() => {
              last.current = ""
              setFound(null)
            }}
          />
        </Animated.View>
      ) : null}
    </View>
  )
}
