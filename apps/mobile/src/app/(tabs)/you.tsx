// M11 You: the business seal, its name and pay address; the mode as two rows (Sandbox · Live) with a check on the
// current one; sound and haptics; the parts that live on the web open there; sign out; the version at the foot.
import * as Clipboard from "expo-clipboard"
import { router } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { Check, Copy, ExternalLink } from "lucide-react-native"
import { useEffect, useState } from "react"
import { Switch, View } from "react-native"

import { webUrl } from "@/api/client"
import { useSession } from "@/auth/session"
import { APP_VERSION } from "@/config"
import { fire, onPrefs, prefs, setPref } from "@/feedback/fire"
import { SHU, usePalette } from "@/theme/tokens"
import { Button } from "@/ui/button"
import { Card, Header, Row, Screen, SectionTitle } from "@/ui/layout"
import { Mark } from "@/ui/mark"
import { Press } from "@/ui/press"
import { BusinessSeal } from "@/ui/seal"
import { SealPress } from "@/ui/seal-press"
import { T } from "@/ui/text"

function usePrefs() {
  const [, bump] = useState(0)
  useEffect(() => {
    const off = onPrefs(() => bump((n) => n + 1))
    return () => {
      off()
    }
  }, [])
  return prefs
}

const WEB_PLACES = [
  { label: "Invoices", path: "/app/invoices" },
  { label: "Customers", path: "/app/customers" },
  { label: "People", path: "/app/people" },
  { label: "Balance and books", path: "/app/balance" },
  { label: "Cards", path: "/app/cards" },
  { label: "Bank", path: "/app/bank" },
  { label: "Developers", path: "/app/developers" },
] as const

export default function You() {
  const p = usePalette()
  const { profile, account, mode, setMode, network, signOut, email } = useSession()
  const settings = usePrefs()
  const [copied, setCopied] = useState(false)
  const liveOn = profile?.networks.includes("mainnet") ?? false
  const name = profile?.workspace?.name ?? "Your business"

  const choose = (next: "sandbox" | "live") => {
    if (next === "live" && !liveOn) return fire("warn")
    fire("tick", { cue: "toggle" })
    setMode(next)
  }

  return (
    <Screen dock>
      <Header title="You" back={false} />
      <View style={{ alignItems: "center", gap: 10 }}>
        <SealPress identity={`you-${profile?.workspace?.id}`} cue={null}>
          <BusinessSeal name={name} size={104} />
        </SealPress>
        <T role="pageTitle" center>
          {name}
        </T>
        {account ? (
          <Press
            haptic="tick"
            onPress={async () => {
              await Clipboard.setStringAsync(account.accountId)
              fire("tick", { cue: "confirmed" })
              setCopied(true)
              setTimeout(() => setCopied(false), 1500)
            }}
            style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: p.plate, borderRadius: 999, paddingHorizontal: 14, height: 36 }}
          >
            <Mark id="near" size={18} />
            <T role="mono">{account.accountId}</T>
            {copied ? <Check size={16} color={p.up} /> : <Copy size={16} color={p.text2} />}
          </Press>
        ) : null}
        {email ? (
          <T role="detail" tone="text3">
            Signed in as {email}
          </T>
        ) : null}
      </View>

      <SectionTitle title="Mode" />
      <Card>
        <Row
          onPress={() => choose("sandbox")}
          left={<ModeDot dashed />}
          title="Sandbox"
          meta="Test dollars on NEAR testnet"
          right={network === "testnet" ? <Check size={22} color={SHU} strokeWidth={3} /> : null}
        />
        <Row
          onPress={() => choose("live")}
          left={<ModeDot />}
          title="Live"
          meta={liveOn ? "Real USDC on NEAR" : "Live opens when Tegata's mainnet operator is switched on"}
          right={mode === "live" && network === "mainnet" ? <Check size={22} color={SHU} strokeWidth={3} /> : null}
        />
      </Card>

      <SectionTitle title="Sound and touch" />
      <Card>
        <Row
          title="Sound"
          meta="Money arriving, sent, the seal"
          right={
            <Switch
              value={settings.sound}
              onValueChange={(on) => {
                setPref("sound", on)
                fire("tick", on ? { cue: "toggle" } : {})
              }}
              trackColor={{ true: SHU, false: p.pressed }}
            />
          }
        />
        <Row
          title="Haptics"
          meta="A tap you can feel"
          right={
            <Switch
              value={settings.haptics}
              onValueChange={(on) => {
                setPref("haptics", on)
                fire("tick")
              }}
              trackColor={{ true: SHU, false: p.pressed }}
            />
          }
        />
      </Card>

      <SectionTitle title="Also on the web" />
      <Card>
        {WEB_PLACES.map((place) => (
          <Row
            key={place.path}
            title={place.label}
            onPress={() => void WebBrowser.openBrowserAsync(webUrl(place.path))}
            right={<ExternalLink size={18} color={p.text3} />}
          />
        ))}
      </Card>

      <Button
        label="Sign out"
        variant="secondary"
        onPress={async () => {
          await signOut()
          router.replace("/sign-in")
        }}
      />
      <T role="meta" tone="text3" center>
        Tegata {APP_VERSION} · Settled on NEAR
      </T>
    </Screen>
  )
}

function ModeDot({ dashed }: { dashed?: boolean }) {
  const p = usePalette()
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2,
        borderStyle: dashed ? "dashed" : "solid",
        borderColor: dashed ? p.text3 : p.ink,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dashed ? p.text3 : SHU }} />
    </View>
  )
}
