// M1 Sign-in: the lit story stage above, a paper sheet below with one email field, then the six-digit code (Privy sends
// it; the person types it). The sixth digit submits; a wrong code shakes; the right one presses the seal.
import { router } from "expo-router"
import { useEffect, useState } from "react"
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native"
import Animated, {
  Easing,
  FadeInDown,
  FadeOutUp,
  useAnimatedStyle,
  withTiming,
} from "react-native-reanimated"
import { useSafeAreaInsets } from "react-native-safe-area-context"

import { useSession } from "@/auth/session"
import { StoryStage } from "@/features/sign-in/story-stage"
import { fire } from "@/feedback/fire"
import { FONT, RADIUS, usePalette } from "@/theme/tokens"
import { Button } from "@/ui/button"
import { CodeField } from "@/ui/code-field"
import { Press } from "@/ui/press"
import { TegataSeal } from "@/ui/seal"
import { SealPress } from "@/ui/seal-press"
import { StageField } from "@/ui/stage"
import { T } from "@/ui/text"

const RESEND_S = 30
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function errorText(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : ""
  if (/network|fetch|offline/i.test(message))
    return "No connection. Your code still works for 10 minutes."
  if (/invalid|incorrect|code/i.test(message))
    return "That code isn't right. Check the latest email."
  return fallback
}

export default function SignIn() {
  const p = usePalette()
  const insets = useSafeAreaInsets()
  const { height } = useWindowDimensions()
  const { sendCode, loginWithCode, authenticated } = useSession()
  const [step, setStep] = useState<"email" | "code" | "done">("email")
  const [email, setEmail] = useState("")
  const [code, setCode] = useState("")
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [shake, setShake] = useState(0)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  // Signed in: hand over to the gate, which opens the account or Home.
  useEffect(() => {
    if (!authenticated || step !== "done") return
    const t = setTimeout(() => router.replace("/"), 900)
    return () => clearTimeout(t)
  }, [authenticated, step])

  async function requestCode() {
    const address = email.trim().toLowerCase()
    if (!EMAIL.test(address)) {
      setProblem("Enter an email like you@business.com")
      fire("warn")
      return
    }
    setBusy(true)
    setProblem(null)
    try {
      await sendCode(address)
      setEmail(address)
      setStep("code")
      setResendIn(RESEND_S)
      fire("tick", { cue: "step" })
    } catch (error) {
      setProblem(errorText(error, "Couldn't send the code. Try again."))
      fire("fail", { cue: "error" })
    } finally {
      setBusy(false)
    }
  }

  async function submit(entered: string) {
    setBusy(true)
    setProblem(null)
    try {
      await loginWithCode(email, entered)
      fire("filled", { cue: "confirmed" })
      setStep("done")
    } catch (error) {
      setProblem(errorText(error, "Couldn't check the code. Try again."))
      setShake((s) => s + 1)
      setCode("")
      fire("fail", { cue: "error" })
    } finally {
      setBusy(false)
    }
  }

  const stageHeight = Math.round(height * 0.5) + insets.top
  // With the keyboard up, the stage folds to its headline so the field and the button stay in view.
  const keyboard = useKeyboardOpen()
  const folded = insets.top + 132
  const stageStyle = useAnimatedStyle(() => ({
    height: withTiming(keyboard ? folded : stageHeight, {
      duration: 320,
      easing: Easing.bezier(0.32, 0.72, 0, 1),
    }),
  }))
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: p.page }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Animated.View style={[{ overflow: "hidden" }, stageStyle]}>
        <StageField tone="lacquer" />
        <View style={{ paddingTop: insets.top + 8 }}>
          <StoryStage height={stageHeight - insets.top - 8} />
        </View>
      </Animated.View>
      <View
        style={{
          flex: 1,
          marginTop: -24,
          backgroundColor: p.page,
          borderTopLeftRadius: RADIUS.sheet,
          borderTopRightRadius: RADIUS.sheet,
          paddingHorizontal: 20,
          paddingTop: 24,
          paddingBottom: insets.bottom + 16,
          gap: 18,
        }}
      >
        {step === "email" ? (
          <Animated.View
            key="email"
            entering={FadeInDown.duration(320)}
            exiting={FadeOutUp.duration(160)}
            style={{ gap: 16 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <SealPress identity="sign-in-mark" cue={null}>
                <TegataSeal size={44} tilt={-4} />
              </SealPress>
              <View style={{ flex: 1 }}>
                <T role="stepTitle">Get paid in dollars.</T>
              </View>
            </View>
            <TextInput
              defaultValue={email}
              onChangeText={(text) => {
                setEmail(text)
                if (problem) setProblem(null)
              }}
              placeholder="you@business.com"
              placeholderTextColor={p.text3}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect={false}
              returnKeyType="go"
              onSubmitEditing={requestCode}
              accessibilityLabel="Email"
              style={{
                height: 56,
                borderRadius: RADIUS.button,
                backgroundColor: p.plate,
                paddingHorizontal: 16,
                fontFamily: FONT.medium,
                fontSize: 17,
                color: p.ink,
              }}
            />
            {problem ? (
              <T role="detailMedium" tone="down">
                {problem}
              </T>
            ) : null}
            <Button
              label="Continue with email"
              busy={busy}
              busyLabel="Sending code"
              onPress={requestCode}
            />
            <T role="meta" tone="text3" center>
              Protected by Privy · no wallet, no fees to think about
            </T>
          </Animated.View>
        ) : (
          <Animated.View
            key="code"
            entering={FadeInDown.duration(320)}
            exiting={FadeOutUp.duration(160)}
            style={{ gap: 18 }}
          >
            <View style={{ gap: 6 }}>
              <T role="stepTitle">{step === "done" ? "You're in." : "Check your email."}</T>
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}
              >
                <T role="body" tone="text2">
                  {step === "done" ? "Opening Tegata…" : `Code sent to ${email}`}
                </T>
                {step === "code" ? (
                  <Press
                    haptic="tick"
                    onPress={() => {
                      setStep("email")
                      setCode("")
                      setProblem(null)
                    }}
                  >
                    <T role="bodyMedium" tone="seal">
                      Edit
                    </T>
                  </Press>
                ) : null}
              </View>
            </View>
            {step === "done" ? (
              <View style={{ alignItems: "center", paddingVertical: 8 }}>
                <SealPress identity={`signed-in-${email}`}>
                  <TegataSeal size={96} tilt={-4} />
                </SealPress>
              </View>
            ) : (
              <>
                <CodeField
                  value={code}
                  onChange={setCode}
                  onComplete={submit}
                  shake={shake}
                  disabled={busy}
                />
                <View
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                    minHeight: 22,
                  }}
                >
                  {busy ? (
                    <T role="detailMedium" tone="text2">
                      Checking
                    </T>
                  ) : problem ? (
                    <T role="detailMedium" tone="down" style={{ flex: 1 }}>
                      {problem}
                    </T>
                  ) : (
                    <View />
                  )}
                  <Press haptic="tick" disabled={resendIn > 0 || busy} onPress={requestCode}>
                    <T role="detailMedium" tone={resendIn > 0 ? "text3" : "seal"}>
                      {resendIn > 0
                        ? `Resend in 0:${String(resendIn).padStart(2, "0")}`
                        : "Resend code"}
                    </T>
                  </Press>
                </View>
              </>
            )}
          </Animated.View>
        )}
      </View>
    </KeyboardAvoidingView>
  )
}

function useKeyboardOpen() {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow"
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide"
    const show = Keyboard.addListener(showEvent, () => setOpen(true))
    const hide = Keyboard.addListener(hideEvent, () => setOpen(false))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return open
}
