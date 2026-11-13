// Sound and touch: one call, `fire(event, { cue, identity })`, the phone twin of apps/web/lib/feedback. The cues are
// the web's own mp3s (Kawase's processed SND kits: sine for the interface, piano for money, industrial for the seal).
// Haptic words are Kawase's table. Nothing plays for typing or navigation; an outcome cue plays once per identity
// (a relay id, a receipt id), so a remount never replays it. Every failure is swallowed: feedback is decoration.
import { type AudioPlayer, createAudioPlayer, setAudioModeAsync } from "expo-audio"
import * as Haptics from "expo-haptics"
import * as SecureStore from "expo-secure-store"
import { Platform } from "react-native"

const SOURCES = {
  tap: require("../../assets/sounds/tap.mp3"),
  toggle: require("../../assets/sounds/toggle.mp3"),
  step: require("../../assets/sounds/step.mp3"),
  scene: require("../../assets/sounds/scene.mp3"),
  sheetOpen: require("../../assets/sounds/sheet-open.mp3"),
  sheetClose: require("../../assets/sounds/sheet-close.mp3"),
  error: require("../../assets/sounds/error.mp3"),
  received: require("../../assets/sounds/received.mp3"),
  sent: require("../../assets/sounds/sent.mp3"),
  confirmed: require("../../assets/sounds/confirmed.mp3"),
  stamp: require("../../assets/sounds/stamp.mp3"),
  celebrate: require("../../assets/sounds/celebrate.mp3"),
} as const

export type Cue = keyof typeof SOURCES

/** Levels the palette (the web's player volumes). */
const VOLUME: Record<Cue, number> = {
  tap: 0.4,
  toggle: 0.6,
  step: 0.45,
  scene: 0.4,
  sheetOpen: 0.25,
  sheetClose: 0.2,
  error: 0.35,
  received: 0.55,
  sent: 0.5,
  confirmed: 0.4,
  stamp: 0.75,
  celebrate: 0.5,
}

export type HapticEvent =
  | "tick"
  | "press"
  | "snap"
  | "confirm"
  | "filled"
  | "warn"
  | "fail"
  | "close"
  | "impact"

const A = Haptics.AndroidHaptics
const ANDROID: Record<HapticEvent, Haptics.AndroidHaptics> = {
  tick: A.Segment_Tick,
  press: A.Virtual_Key,
  snap: A.Gesture_End,
  confirm: A.Confirm,
  filled: A.Confirm,
  warn: A.Reject,
  fail: A.Reject,
  close: A.Virtual_Key,
  impact: A.Long_Press,
}

function ios(event: HapticEvent): Promise<void> {
  switch (event) {
    case "tick":
      return Haptics.selectionAsync()
    case "press":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    case "snap":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Rigid)
    case "confirm":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft)
    case "filled":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    case "warn":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
    case "fail":
      return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)
    case "close":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
    case "impact":
      return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)
  }
}

const SOUND_KEY = "tegata.sound"
const HAPTICS_KEY = "tegata.haptics"
export const prefs = { sound: true, haptics: true }
let loaded = false
const listeners = new Set<() => void>()

export async function loadPrefs() {
  if (loaded) return
  loaded = true
  try {
    const [sound, haptics] = await Promise.all([
      SecureStore.getItemAsync(SOUND_KEY),
      SecureStore.getItemAsync(HAPTICS_KEY),
    ])
    prefs.sound = sound !== "off"
    prefs.haptics = haptics !== "off"
    listeners.forEach((listener) => listener())
  } catch {
    // Defaults stand.
  }
}

export function setPref(key: "sound" | "haptics", on: boolean) {
  prefs[key] = on
  listeners.forEach((listener) => listener())
  void SecureStore.setItemAsync(key === "sound" ? SOUND_KEY : HAPTICS_KEY, on ? "on" : "off").catch(
    () => undefined,
  )
}

export function onPrefs(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const players = new Map<Cue, AudioPlayer>()
const heard = new Set<string>()
let modeSet = false

function player(cue: Cue): AudioPlayer {
  let existing = players.get(cue)
  if (!existing) {
    existing = createAudioPlayer(SOURCES[cue])
    existing.volume = VOLUME[cue]
    players.set(cue, existing)
  }
  return existing
}

/** Load every cue once at launch, so the first "sent" plays on time. */
export function warmFeedback() {
  void loadPrefs()
  if (!modeSet) {
    modeSet = true
    // Follow the silent switch like any iOS app; never take audio focus from music for longer than a cue.
    void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(
      () => undefined,
    )
  }
  try {
    for (const cue of Object.keys(SOURCES) as Cue[]) player(cue)
  } catch {
    // A cue that can't load now loads on first use.
  }
}

export function haptic(event: HapticEvent) {
  if (!prefs.haptics || Platform.OS === "web") return
  const run =
    Platform.OS === "android" ? Haptics.performAndroidHapticsAsync(ANDROID[event]) : ios(event)
  run.catch(() => undefined)
}

export function playCue(cue: Cue) {
  if (!prefs.sound) return
  try {
    const p = player(cue)
    void p.seekTo(0).then(() => p.play())
  } catch {
    // Silent.
  }
}

/**
 * The one call site: a haptic word, optionally a sound cue. `identity` makes an outcome cue play once only
 * (a remount, a re-poll or a revisit never replays "received" for the same payment).
 */
export function fire(event: HapticEvent, options: { cue?: Cue; identity?: string } = {}) {
  try {
    if (options.identity) {
      const key = `${options.cue ?? event}:${options.identity}`
      if (heard.has(key)) return
      heard.add(key)
    }
    haptic(event)
    if (options.cue) playCue(options.cue)
  } catch {
    // Never throws into a money flow.
  }
}
