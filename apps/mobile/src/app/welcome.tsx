// M2 Account opening: one question per step under a thin progress line. (1) The business's name, with its own round
// seal re-cut live on the stage. (2) The pay address `name.tegata.near`, availability said inside the field. (3) The
// account opening on NEAR as named stages, then the seal presses with `celebrate` and Home opens.
import { getCalendars } from "expo-localization"
import { router } from "expo-router"
import { StatusBar } from "expo-status-bar"
import { useEffect, useRef, useState } from "react"
import { KeyboardAvoidingView, Platform, TextInput, View } from "react-native"
import Animated, { FadeInDown, FadeOutUp, useAnimatedStyle, withTiming } from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { ApiError, api } from "@/api/client"
import type { HandleCheck } from "@/api/types"
import { queryClient, useSession } from "@/auth/session"
import { fire } from "@/feedback/fire"
import { FONT, RADIUS, usePalette } from "@/theme/tokens"
import { Button } from "@/ui/button"
import { BusinessSeal } from "@/ui/seal"
import { SealPress } from "@/ui/seal-press"
import { StageField, StageObject } from "@/ui/stage"
import { TaskSteps } from "@/ui/task-steps"
import { T } from "@/ui/text"

const DEBOUNCE_MS = 350

function useHandleCheck(name: string, from: string) {
  const [check, setCheck] = useState<HandleCheck | null>(null)
  const [checking, setChecking] = useState(false)
  useEffect(() => {
    const query = name ? `name=${encodeURIComponent(name)}` : from ? `from=${encodeURIComponent(from)}` : ""
    if (!query) return
    setChecking(true)
    const t = setTimeout(() => {
      api<HandleCheck>(`/api/handle?${query}`)
        .then(setCheck)
        .catch(() => setCheck(null))
        .finally(() => setChecking(false))
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [name, from])
  return { check, checking }
}

export default function Welcome() {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const { profile, refetchProfile, network } = useSession()
  const [step, setStep] = useState<0 | 1 | 2>(profile?.workspace ? 2 : 0)
  const [business, setBusiness] = useState("")
  const [handle, setHandle] = useState("")
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const { check, checking } = useHandleCheck(touched ? handle : "", business)
  const celebrated = useRef(false)

  // The first suggestion comes from the business name until the person edits the handle.
  useEffect(() => {
    if (!touched && check?.handle) setHandle(check.handle)
  }, [check?.handle, touched])

  const account = profile?.accounts.find((a) => a.network === network) ?? profile?.accounts[0]
  const opening = step === 2
  const ready = Boolean(account?.readyAt)
  const stage = !account ? 0 : !account.createdTx ? 0 : !account.registeredTx ? 1 : ready ? 3 : 2

  useEffect(() => {
    if (!opening) return
    const t = setInterval(refetchProfile, 2000)
    return () => clearInterval(t)
  }, [opening, refetchProfile])

  useEffect(() => {
    if (ready && opening && !celebrated.current) {
      celebrated.current = true
      fire("filled", { cue: "celebrate", identity: `opened-${account?.id}` })
      const t = setTimeout(() => router.replace("/(tabs)"), 2200)
      return () => clearTimeout(t)
    }
  }, [ready, opening, account?.id])

  async function open() {
    setBusy(true)
    setProblem(null)
    try {
      const timezone = getCalendars()[0]?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC"
      await api("/api/onboard", { body: { handle, businessName: business.trim(), timezone } })
      await queryClient.invalidateQueries({ queryKey: ["me"] })
      setStep(2)
      fire("tick", { cue: "step" })
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : "Couldn't open the account. Try again.")
      fire("fail", { cue: "error" })
    } finally {
      setBusy(false)
    }
  }

  const progress = useAnimatedStyle(() => ({ width: withTiming(`${((step + 1) / 3) * 100}%`, { duration: 320 }) }))
  const name = business.trim() || profile?.workspace?.name || "Your business"
  const handleOk = check?.available && check.handle === handle && !checking

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.page }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <StatusBar style="light" />
      <View style={{ height: 300 + insets.top, overflow: "hidden" }}>
        <StageField tone={ready ? "paid" : "shu"} />
        <View style={{ height: 2, marginTop: insets.top + 6, marginHorizontal: 20, backgroundColor: "#FFFFFF40", borderRadius: 1 }}>
          <Animated.View style={[{ height: 2, backgroundColor: "#FFFFFF", borderRadius: 1 }, progress]} />
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 14 }}>
          {ready ? (
            <SealPress identity={`opened-seal-${account?.id}`}>
              <BusinessSeal name={name} band="Open" size={170} color="#FFFFFF" />
            </SealPress>
          ) : (
            <StageObject from={{ y: 20, rotate: -6 }}>
              <BusinessSeal name={name} size={170} color="#FFFFFF" />
            </StageObject>
          )}
          {step >= 1 ? (
            <View style={{ backgroundColor: "#FFFFFF", borderRadius: RADIUS.pill, paddingHorizontal: 14, paddingVertical: 6 }}>
              <T role="mono" color="#000">
                {(account?.accountId ?? `${handle || "name"}.${network === "mainnet" ? "tegata.near" : "tegata.testnet"}`).toLowerCase()}
              </T>
            </View>
          ) : null}
        </View>
      </View>
      <View style={{ flex: 1, padding: 20, paddingBottom: insets.bottom + 16, gap: 16 }}>
        {step === 0 ? (
          <Animated.View key="name" entering={FadeInDown.duration(320)} exiting={FadeOutUp.duration(160)} style={{ gap: 16 }}>
            <T role="stepTitle">What's the business called?</T>
            <TextInput
              value={business}
              onChangeText={setBusiness}
              placeholder="Business name"
              placeholderTextColor={p.text3}
              autoFocus
              maxLength={80}
              returnKeyType="next"
              onSubmitEditing={() => business.trim() && setStep(1)}
              style={{ height: 56, borderRadius: RADIUS.button, backgroundColor: p.plate, paddingHorizontal: 16, fontFamily: FONT.medium, fontSize: 17, color: p.ink }}
            />
            <Button
              label="Continue"
              disabled={!business.trim()}
              onPress={() => {
                fire("tick", { cue: "step" })
                setStep(1)
              }}
            />
          </Animated.View>
        ) : step === 1 ? (
          <Animated.View key="handle" entering={FadeInDown.duration(320)} exiting={FadeOutUp.duration(160)} style={{ gap: 16 }}>
            <T role="stepTitle">Your pay address</T>
            <View style={{ height: 56, borderRadius: RADIUS.button, backgroundColor: p.plate, paddingHorizontal: 16, flexDirection: "row", alignItems: "center" }}>
              <TextInput
                value={handle}
                onChangeText={(text) => {
                  setTouched(true)
                  setHandle(text.toLowerCase().replace(/[^a-z0-9-_]/g, ""))
                }}
                autoFocus
                autoCapitalize="none"
                autoCorrect={false}
                style={{ flex: 1, fontFamily: FONT.mono, fontSize: 17, color: p.ink }}
              />
              <T role="mono" tone="text3">
                .{network === "mainnet" ? "tegata.near" : "tegata.testnet"}
              </T>
            </View>
            <T role="detailMedium" tone={checking ? "text3" : handleOk ? "up" : "down"}>
              {checking ? "Checking…" : handleOk ? "Available" : (check?.problem ?? " ")}
            </T>
            {problem ? (
              <T role="detailMedium" tone="down">
                {problem}
              </T>
            ) : null}
            <Button label="Open my account" busy={busy} busyLabel="Opening" disabled={!handleOk} onPress={open} />
          </Animated.View>
        ) : (
          <Animated.View key="opening" entering={FadeInDown.duration(320)} style={{ gap: 18 }}>
            <T role="stepTitle">{ready ? "Your account is open." : "Opening your account"}</T>
            <TaskSteps
              steps={[`Creating ${account?.accountId ?? "your account"} on NEAR`, "Registering for USDC", "Ready to get paid"]}
              current={stage}
            />
            {ready ? <Button label="Go to Home" onPress={() => router.replace("/(tabs)")} /> : null}
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}
