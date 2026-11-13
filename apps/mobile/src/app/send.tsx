// M6 Send on NEAR. To → amount → review → hold to approve → named stages on NEAR → the receipt with the seal.
// The server drafts the USDC transfer; the phone re-encodes it and checks it is exactly the payment on screen
// (receiver, amount, the USDC contract, the hash) before Privy's key signs, then follows the relay to its end.
import { useQuery } from "@tanstack/react-query"
import * as Clipboard from "expo-clipboard"
import { router, useLocalSearchParams } from "expo-router"
import * as WebBrowser from "expo-web-browser"
import { ClipboardPaste, ScanLine } from "lucide-react-native"
import { useEffect, useState } from "react"
import { KeyboardAvoidingView, Platform, ScrollView, TextInput, View } from "react-native"
import Animated, { FadeInDown, FadeOutUp } from "react-native-reanimated"

import { ApiError, api } from "@/api/client"
import type { RelayStatus, SendDraft, TeamPerson } from "@/api/types"
import { queryClient, useSession } from "@/auth/session"
import { NETWORKS } from "@/config"
import { ReceiptSlip } from "@/features/receipt/receipt-slip"
import { fire } from "@/feedback/fire"
import { amountOk, toUnits, typedAmount, usd } from "@/lib/money"
import { checkSend } from "@/near/draft"
import { FONT, ON_STAGE, PAPER, RADIUS, usePalette } from "@/theme/tokens"
import { Button } from "@/ui/button"
import { Figure } from "@/ui/figure"
import { HoldButton } from "@/ui/hold-button"
import { Keypad } from "@/ui/keypad"
import { Header, Problem, Screen } from "@/ui/layout"
import { Mark } from "@/ui/mark"
import { Press } from "@/ui/press"
import { Stage } from "@/ui/stage"
import { TaskSteps } from "@/ui/task-steps"
import { T } from "@/ui/text"

type Step = "to" | "amount" | "review" | "sending" | "sent" | "failed"
const TERMINAL = new Set(["success", "failed", "expired"])

export default function Send() {
  const p = usePalette()
  const params = useLocalSearchParams<{ to?: string; amount?: string }>()
  const { account, network, profile, sign } = useSession()
  const [step, setStep] = useState<Step>(params.to ? "amount" : "to")
  const [to, setTo] = useState((params.to ?? "").toLowerCase())
  // The field keeps its own text (fast typing and paste never drop keys); a paste or a chip remounts it with the value.
  const [toField, setToField] = useState(0)
  const fillTo = (value: string) => {
    setTo(value.trim().toLowerCase())
    setToField((n) => n + 1)
  }
  const [amount, setAmount] = useState(params.amount ?? "")
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [send, setSend] = useState<SendDraft | null>(null)
  const balance = BigInt(account?.balance ?? "0")
  const suffix = `.${NETWORKS[network].operator}`
  const business = profile?.workspace?.name ?? "Your business"

  const team = useQuery({
    queryKey: ["people", network],
    queryFn: () => api<{ people: TeamPerson[] }>("/api/people"),
    select: (data) =>
      data.people.flatMap((person) =>
        person.ready.state === "ready" && person.ready.kind !== "chain" && person.ready.accountId
          ? [{ id: person.id, name: person.name, accountId: person.ready.accountId }]
          : [],
      ),
  })

  const relay = useQuery({
    queryKey: ["relay", send?.relayId],
    queryFn: () => api<RelayStatus>(`/api/relay/${send?.relayId}`),
    enabled: (step === "sending" || step === "sent") && Boolean(send),
    refetchInterval: (q) => (q.state.data && TERMINAL.has(q.state.data.status) ? false : 1200),
  })
  const status = relay.data?.status
  useEffect(() => {
    if (step !== "sending" || !send) return
    if (status === "success") {
      fire("filled", { cue: "sent", identity: send.relayId })
      void queryClient.invalidateQueries({ queryKey: ["me"] })
      void queryClient.invalidateQueries({ queryKey: ["activity"] })
      setStep("sent")
    } else if (status === "failed" || status === "expired") {
      fire("fail", { cue: "error" })
      setProblem(`${relay.data?.error ?? "NEAR didn't accept it."} Nothing moved.`)
      setStep("failed")
    }
  }, [status, step, send, relay.data?.error])

  const recipient = to.trim().toLowerCase()
  const units = amountOk(amount) ? toUnits(amount) : 0n
  const short = units > balance

  async function review() {
    setBusy(true)
    setProblem(null)
    try {
      const draft = await api<SendDraft>("/api/sends", { body: { network, to: recipient, amount } })
      setSend(draft)
      setStep("review")
      fire("tick", { cue: "step" })
    } catch (error) {
      fire("fail", { cue: "error" })
      const message =
        error instanceof ApiError ? error.message : "Couldn't prepare the payment. Try again."
      setProblem(message)
      if (error instanceof ApiError && /recipient|exist|receive/.test(error.code + message))
        setStep("to")
    } finally {
      setBusy(false)
    }
  }

  async function approve() {
    if (!send) return
    setBusy(true)
    setProblem(null)
    try {
      // The phone's own check: this is one USDC transfer of exactly this amount to exactly this account.
      checkSend(send.draft, {
        usdc: NETWORKS[network].usdc,
        to: recipient,
        amount: units.toString(),
      })
      const signature = await sign(send.draft.hash)
      await api("/api/relay/sign", { body: { relayId: send.relayId, signature } })
      setStep("sending")
    } catch (error) {
      fire("fail", { cue: "error" })
      setProblem(error instanceof Error ? error.message : "Couldn't approve the payment")
    } finally {
      setBusy(false)
    }
  }

  const progress = status === "success" ? 3 : status === "sent" || status === "unknown" ? 2 : 1

  if (step === "sent" || (step === "sending" && send) || step === "failed")
    return (
      <Screen>
        <Header
          title={step === "sent" ? "Sent" : step === "failed" ? "Didn't go through" : "Sending"}
          back={step !== "sending"}
        />
        {step === "failed" ? (
          <>
            <Problem text={problem ?? "Nothing moved."} />
            <Button label="Try again" onPress={() => setStep("review")} />
          </>
        ) : (
          <>
            <ReceiptSlip
              business={business}
              heading="Send on NEAR"
              title={`To ${recipient}`}
              amount={units.toString()}
              incoming={false}
              settledAt={step === "sent" ? new Date().toISOString() : null}
              identity={send?.relayId ?? recipient}
              rows={[
                ["To", recipient],
                ["Arrives as", "USDC on NEAR"],
                ["Network fee", "Paid by Tegata"],
                [
                  "Transaction",
                  relay.data?.txHash ? `${relay.data.txHash.slice(0, 10)}…` : "On its way",
                ],
              ]}
              footer={
                step === "sending" ? (
                  <View style={{ paddingTop: 6 }}>
                    <TaskSteps steps={["Signed by you", "On NEAR", "Settled"]} current={progress} />
                  </View>
                ) : null
              }
            />
            {step === "sent" ? (
              <View style={{ gap: 10 }}>
                {relay.data?.explorerUrl ? (
                  <Button
                    variant="secondary"
                    label="Open on NEAR"
                    icon={<Mark id="near" size={20} />}
                    onPress={() => void WebBrowser.openBrowserAsync(relay.data?.explorerUrl ?? "")}
                  />
                ) : null}
                <Button label="Done" onPress={() => router.back()} />
              </View>
            ) : null}
          </>
        )}
      </Screen>
    )

  if (step === "review" && send)
    return (
      <Screen>
        <Header title="Review" onBack={() => setStep("amount")} />
        <Animated.View entering={FadeInDown.duration(320)} style={{ gap: 16 }}>
          <View
            style={{ backgroundColor: p.card, borderRadius: RADIUS.group, padding: 20, gap: 16 }}
          >
            <T role="detailMedium" tone="text2">
              You send
            </T>
            <Figure units={units} size={56} color={p.ink} />
            {[
              [
                "To",
                <View key="to" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Mark id="near" size={20} />
                  <T role="mono">{recipient}</T>
                </View>,
              ],
              [
                "Arrives as",
                <View key="as" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <Mark id="usdc" chain="near" size={20} />
                  <T role="bodyMedium">USDC on NEAR</T>
                </View>,
              ],
              [
                "Network fee",
                <T key="fee" role="bodyMedium" tone="up">
                  Paid by Tegata
                </T>,
              ],
              [
                "Balance after",
                <T key="after" role="bodyMedium">
                  {usd(balance - units)}
                </T>,
              ],
            ].map(([label, value]) => (
              <View
                key={label as string}
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <T role="detail" tone="text2">
                  {label as string}
                </T>
                {value}
              </View>
            ))}
          </View>
          {problem ? <Problem text={problem} /> : null}
          <HoldButton
            label={`Send ${usd(units)}`}
            busy={busy}
            busyLabel="Approving"
            onConfirm={approve}
          />
          <Button label="Edit" variant="secondary" onPress={() => setStep("amount")} />
        </Animated.View>
      </Screen>
    )

  if (step === "amount")
    return (
      <Screen scroll={false}>
        <Header title={`To ${recipient}`} onBack={() => setStep("to")} />
        <Animated.View
          key="amount"
          entering={FadeInDown.duration(320)}
          exiting={FadeOutUp.duration(160)}
          style={{ flex: 1, justifyContent: "space-between" }}
        >
          <Stage
            style={{ alignItems: "center", gap: 12, paddingVertical: 24, paddingHorizontal: 20 }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <Mark id="usdc" chain="near" size={20} />
              <T role="detailMedium" color={ON_STAGE.soft}>
                Arrives as USDC on NEAR
              </T>
            </View>
            <Figure
              text={`$${typedAmount(amount)}`}
              size={72}
              color={amount ? ON_STAGE.ink : ON_STAGE.faint}
            />
            <View style={{ flexDirection: "row", gap: 16, alignItems: "center" }}>
              <View
                style={{
                  backgroundColor: short ? PAPER.face : "transparent",
                  borderRadius: 999,
                  paddingHorizontal: short ? 10 : 0,
                  paddingVertical: 4,
                }}
              >
                <T role="detailMedium" color={short ? p.down : ON_STAGE.soft}>
                  {short ? "More than your balance" : `${usd(balance)} available`}
                </T>
              </View>
              <Press
                haptic="tick"
                onPress={() =>
                  setAmount((Number(balance / 10_000n) / 100).toFixed(2).replace(/\.00$/, ""))
                }
                style={{
                  backgroundColor: ON_STAGE.veil,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  height: 30,
                  justifyContent: "center",
                }}
              >
                <T role="detailMedium" color={ON_STAGE.ink}>
                  Max
                </T>
              </Press>
            </View>
          </Stage>
          <View style={{ gap: 12 }}>
            {problem ? <Problem text={problem} /> : null}
            <Keypad
              value={amount}
              onChange={(v) => {
                setAmount(v)
                setProblem(null)
              }}
            />
            <Button
              label="Review"
              busy={busy}
              busyLabel="Preparing"
              disabled={!amountOk(amount) || short}
              onPress={review}
            />
          </View>
        </Animated.View>
      </Screen>
    )

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Screen>
        <Header title="Send" />
        <Stage style={{ padding: 18, gap: 4 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Mark id="usdc" chain="near" size={20} />
            <T role="detailMedium" color={ON_STAGE.soft}>
              Available · fees paid by Tegata
            </T>
          </View>
          <Figure units={balance} size={44} color={ON_STAGE.ink} />
        </Stage>
        <Animated.View entering={FadeInDown.duration(320)} style={{ gap: 14 }}>
          <T role="detailMedium" tone="text2">
            To a NEAR account
          </T>
          <View
            style={{
              height: 56,
              borderRadius: RADIUS.button,
              backgroundColor: p.plate,
              paddingLeft: 14,
              paddingRight: 6,
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
            }}
          >
            <Mark id="near" size={22} />
            <TextInput
              key={toField}
              defaultValue={to}
              onChangeText={(text) => {
                setTo(text.toLowerCase().trim())
                setProblem(null)
              }}
              placeholder={`name${suffix}`}
              placeholderTextColor={p.text3}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              returnKeyType="next"
              onSubmitEditing={() => recipient.length > 1 && setStep("amount")}
              style={{ flex: 1, fontFamily: FONT.mono, fontSize: 16, color: p.ink }}
            />
            <Press
              haptic="tick"
              accessibilityLabel="Paste"
              onPress={async () => fillTo((await Clipboard.getStringAsync()) ?? "")}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <ClipboardPaste size={20} color={p.text2} />
            </Press>
            <Press
              haptic="tick"
              accessibilityLabel="Scan"
              onPress={() => router.replace("/scan")}
              style={{ width: 44, height: 44, alignItems: "center", justifyContent: "center" }}
            >
              <ScanLine size={20} color={p.text2} />
            </Press>
          </View>
          {problem ? (
            <T role="detailMedium" tone="down">
              {problem}
            </T>
          ) : null}
          {team.data && team.data.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 8 }}
            >
              {team.data.map((person) => (
                <Press
                  key={person.id}
                  haptic="tick"
                  onPress={() => {
                    fillTo(person.accountId)
                    setStep("amount")
                  }}
                  style={{
                    backgroundColor: to === person.accountId ? p.sealWash : p.card,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    height: 40,
                    justifyContent: "center",
                  }}
                >
                  <T role="detailMedium">{person.name}</T>
                </Press>
              ))}
            </ScrollView>
          ) : null}
          <Button
            label="Continue"
            disabled={recipient.length < 2}
            onPress={() => setStep("amount")}
          />
        </Animated.View>
      </Screen>
    </KeyboardAvoidingView>
  )
}
