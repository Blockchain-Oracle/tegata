// M5 New pay link: the amount on a bare keypad (or "Any amount"), then a name and an optional note, then the link on
// the stage with its QR, Share and Copy. Created in the current mode (the API reads the mode header).
import { router } from "expo-router"
import { useState } from "react"
import { KeyboardAvoidingView, Platform, TextInput, View } from "react-native"
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated"

import { ApiError, api } from "@/api/client"
import type { PayLink } from "@/api/types"
import { queryClient, useSession } from "@/auth/session"
import { LinkCard } from "@/features/links/link-card"
import { fire } from "@/feedback/fire"
import { amountOk, typedAmount } from "@/lib/money"
import { FONT, ON_STAGE, PAPER, RADIUS, usePalette } from "@/theme/tokens"
import { Button } from "@/ui/button"
import { Figure } from "@/ui/figure"
import { Keypad } from "@/ui/keypad"
import { Header, Screen } from "@/ui/layout"
import { Mark } from "@/ui/mark"
import { Press } from "@/ui/press"
import { Stage } from "@/ui/stage"
import { T } from "@/ui/text"

export default function NewLink() {
  const p = usePalette()
  const { profile } = useSession()
  const [step, setStep] = useState<"amount" | "details" | "done">("amount")
  const [amount, setAmount] = useState("")
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState("")
  const [note, setNote] = useState("")
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [link, setLink] = useState<PayLink | null>(null)
  const business = profile?.workspace?.name ?? "Your business"

  async function create() {
    setBusy(true)
    setProblem(null)
    try {
      const { link: created } = await api<{ link: PayLink }>("/api/links", {
        body: {
          title: title.trim(),
          ...(note.trim() ? { note: note.trim() } : {}),
          ...(open ? {} : { amount }),
        },
      })
      setLink(created)
      setStep("done")
      void queryClient.invalidateQueries({ queryKey: ["links"] })
    } catch (error) {
      setProblem(error instanceof ApiError ? error.message : "Couldn't make the link. Try again.")
      fire("fail", { cue: "error" })
    } finally {
      setBusy(false)
    }
  }

  if (step === "done" && link)
    return (
      <Screen>
        <Header title="Link ready" />
        <LinkCard link={link} business={business} fresh />
        <Button label="Done" variant="secondary" onPress={() => router.replace("/links")} />
      </Screen>
    )

  if (step === "details")
    return (
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Screen>
          <Header title="Name the link" onBack={() => setStep("amount")} />
          <Animated.View entering={FadeInDown.duration(320)} style={{ gap: 14 }}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <Stage
                style={{
                  flex: 1,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  paddingHorizontal: 18,
                  paddingVertical: 14,
                }}
              >
                {open ? (
                  <T role="price" color={ON_STAGE.ink}>
                    Any amount
                  </T>
                ) : (
                  <Figure text={`$${typedAmount(amount)}`} size={40} color={ON_STAGE.ink} />
                )}
                <Press
                  haptic="tick"
                  onPress={() => setStep("amount")}
                  style={{
                    backgroundColor: ON_STAGE.veil,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    height: 34,
                    justifyContent: "center",
                  }}
                >
                  <T role="detailMedium" color={ON_STAGE.ink}>
                    Change
                  </T>
                </Press>
              </Stage>
            </View>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What it's for"
              placeholderTextColor={p.text3}
              autoFocus
              maxLength={80}
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
            <TextInput
              value={note}
              onChangeText={setNote}
              placeholder="A note for the payer (optional)"
              placeholderTextColor={p.text3}
              maxLength={280}
              multiline
              style={{
                minHeight: 88,
                borderRadius: RADIUS.button,
                backgroundColor: p.plate,
                padding: 16,
                fontFamily: FONT.regular,
                fontSize: 16,
                color: p.ink,
                textAlignVertical: "top",
              }}
            />
            {problem ? (
              <T role="detailMedium" tone="down">
                {problem}
              </T>
            ) : null}
            <Button
              label="Make the link"
              busy={busy}
              busyLabel="Making the link"
              disabled={!title.trim()}
              onPress={create}
            />
          </Animated.View>
        </Screen>
      </KeyboardAvoidingView>
    )

  return (
    <Screen scroll={false}>
      <Header title="New pay link" />
      <Animated.View
        key="amount"
        entering={FadeInDown.duration(320)}
        exiting={FadeOutUp.duration(160)}
        style={{ flex: 1, justifyContent: "space-between" }}
      >
        <Stage
          style={{ alignItems: "center", gap: 14, paddingVertical: 26, paddingHorizontal: 20 }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Mark id="usdc" chain="near" size={20} />
            <T role="detailMedium" color={ON_STAGE.soft}>
              Paid to you in USDC on NEAR
            </T>
          </View>
          {open ? (
            <T role="hero" center color={ON_STAGE.ink}>
              Any amount
            </T>
          ) : (
            <Figure
              text={`$${typedAmount(amount)}`}
              size={72}
              color={amount ? ON_STAGE.ink : ON_STAGE.faint}
            />
          )}
          <Press
            haptic="tick"
            onPress={() => setOpen((o) => !o)}
            style={{
              borderRadius: 999,
              paddingHorizontal: 14,
              height: 34,
              justifyContent: "center",
              backgroundColor: open ? PAPER.face : ON_STAGE.veil,
            }}
          >
            <T role="detailMedium" color={open ? PAPER.ink : ON_STAGE.ink}>
              {open ? "The payer types the amount" : "Let the payer choose"}
            </T>
          </Press>
        </Stage>
        <View style={{ gap: 12 }}>
          {open ? null : <Keypad value={amount} onChange={setAmount} />}
          <Button
            label="Continue"
            disabled={!open && !amountOk(amount)}
            onPress={() => {
              fire("tick", { cue: "step" })
              setStep("details")
            }}
          />
        </View>
      </Animated.View>
    </Screen>
  )
}
