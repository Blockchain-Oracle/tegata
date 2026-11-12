"use client"

/**
 * Sound and touch (plan 6.6): the one call site, `fire(event, { cue, identity })`, ported from Senryo's web feedback
 * (metropolis/apps/web/src/lib/feedback) and Kawase's `fire()`. Cues are Kawase's processed SND kits in
 * public/sounds (piano for money, sine for the interface, the industrial "button" for the seal). Web Audio buffers,
 * unlocked on the first gesture; `navigator.vibrate` on phones, a hidden native switch on iPhone.
 *
 *   fire("press", { cue: "tap" })                         a main action pressed
 *   fire("tick", { cue: "toggle" })                       a switch, the mode capsule
 *   fire("filled", { cue: "received", identity: txHash }) money arrived (never replayed for the same payment)
 *   fire("confirm", { cue: "stamp" })                     the seal lands
 *
 * Nothing plays for typing, hover or navigation. Feedback never throws into the action it accompanies.
 */
import { useSyncExternalStore } from "react"

export type Cue =
  | "tap"
  | "toggle"
  | "scene"
  | "step"
  | "sheetOpen"
  | "sheetClose"
  | "error"
  | "received"
  | "sent"
  | "confirmed"
  | "stamp"
  | "celebrate"

export type HapticEvent = "tick" | "press" | "confirm" | "filled" | "fail" | "warn"

/** Files and levelled volumes (Kawase's CUE_VOLUME / FILM_VOLUME, measured by prepare-sounds.mjs). */
export const CUES: Record<Cue, { file: string; volume: number; label: string }> = {
  tap: { file: "/sounds/tap.mp3", volume: 0.4, label: "Main action" },
  toggle: { file: "/sounds/toggle.mp3", volume: 0.7, label: "Switch" },
  scene: { file: "/sounds/scene.mp3", volume: 0.4, label: "Story scene" },
  step: { file: "/sounds/step.mp3", volume: 0.59, label: "Step done" },
  sheetOpen: { file: "/sounds/sheet-open.mp3", volume: 0.21, label: "Sheet opens" },
  sheetClose: { file: "/sounds/sheet-close.mp3", volume: 0.15, label: "Sheet closes" },
  error: { file: "/sounds/error.mp3", volume: 0.24, label: "Failure" },
  received: { file: "/sounds/received.mp3", volume: 0.4, label: "Money arrived" },
  sent: { file: "/sounds/sent.mp3", volume: 0.4, label: "Money sent" },
  confirmed: { file: "/sounds/confirmed.mp3", volume: 0.27, label: "Confirmed" },
  stamp: { file: "/sounds/stamp.mp3", volume: 0.8, label: "Seal lands" },
  celebrate: { file: "/sounds/celebrate.mp3", volume: 0.42, label: "Account open" },
}

const VIBRATE: Record<HapticEvent, number | number[]> = {
  tick: 8,
  press: 12,
  confirm: [10, 30, 18],
  filled: [14, 40, 24],
  fail: [30, 50, 30],
  warn: [20, 40],
}
const IOS_CLICKS: Record<HapticEvent, number> = {
  tick: 1,
  press: 1,
  confirm: 2,
  filled: 2,
  fail: 3,
  warn: 2,
}
const IOS_CLICK_GAP_MS = 70
const STORAGE_KEY = "tegata.feedback.v1"

type Settings = { sound: boolean; haptics: boolean }
const DEFAULTS: Settings = { sound: true, haptics: true }

let settings: Settings | null = null
const listeners = new Set<() => void>()

function read(): Settings {
  if (settings) return settings
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Settings>
    settings = {
      sound: typeof raw.sound === "boolean" ? raw.sound : DEFAULTS.sound,
      haptics: typeof raw.haptics === "boolean" ? raw.haptics : DEFAULTS.haptics,
    }
  } catch {
    settings = { ...DEFAULTS }
  }
  return settings
}

export function setFeedback(patch: Partial<Settings>): void {
  settings = { ...read(), ...patch }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    // The choice holds for this page.
  }
  for (const l of listeners) l()
}

export function useFeedback(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
    () => DEFAULTS,
  )
}

// --- audio -------------------------------------------------------------------------------------------------------

let ctx: AudioContext | null = null
const buffers = new Map<Cue, Promise<AudioBuffer | null>>()
const played = new Set<string>()
let unlocked = false

function context(): AudioContext | null {
  if (typeof window === "undefined") return null
  if (!ctx) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null
    ctx = new Ctor()
  }
  return ctx
}

function load(cue: Cue): Promise<AudioBuffer | null> {
  let pending = buffers.get(cue)
  if (!pending) {
    const audio = context()
    pending = audio
      ? fetch(CUES[cue].file)
          .then((r) => r.arrayBuffer())
          .then((b) => audio.decodeAudioData(b))
          .catch(() => null)
      : Promise.resolve(null)
    buffers.set(cue, pending)
  }
  return pending
}

/** Browsers keep audio silent until a gesture; resume on the first one and warm the common cues. */
function unlockOnce(): void {
  if (unlocked || typeof window === "undefined") return
  unlocked = true
  const events = ["pointerdown", "keydown", "touchend"] as const
  const unlock = () => {
    const audio = context()
    if (audio && audio.state !== "running") void audio.resume()
    for (const cue of ["tap", "toggle", "step", "confirmed", "stamp"] as Cue[]) void load(cue)
    for (const e of events) window.removeEventListener(e, unlock, true)
  }
  for (const e of events) window.addEventListener(e, unlock, { capture: true, passive: true })
}

if (typeof window !== "undefined") unlockOnce()

export function playCue(cue: Cue): void {
  if (!read().sound) return
  const audio = context()
  if (audio?.state !== "running") return
  void load(cue).then((buffer) => {
    if (!buffer) return
    const source = audio.createBufferSource()
    const gain = audio.createGain()
    gain.gain.value = CUES[cue].volume
    source.buffer = buffer
    source.connect(gain).connect(audio.destination)
    source.start()
  })
}

// --- haptics -----------------------------------------------------------------------------------------------------

let iosSwitch: HTMLInputElement | null = null

function isAppleTouch(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

function haptic(event: HapticEvent): void {
  if (!read().haptics || typeof navigator === "undefined") return
  if (typeof navigator.vibrate === "function") {
    navigator.vibrate(VIBRATE[event])
    return
  }
  if (!isAppleTouch()) return
  if (!iosSwitch) {
    const label = document.createElement("label")
    label.setAttribute("aria-hidden", "true")
    label.style.cssText =
      "position:fixed;width:0;height:0;overflow:hidden;opacity:0;pointer-events:none"
    const input = document.createElement("input")
    input.type = "checkbox"
    input.setAttribute("switch", "")
    input.tabIndex = -1
    label.appendChild(input)
    document.body.appendChild(label)
    iosSwitch = input
  }
  const input = iosSwitch
  for (let i = 0; i < IOS_CLICKS[event]; i++) setTimeout(() => input.click(), i * IOS_CLICK_GAP_MS)
}

/** A haptic word, optionally with a cue. An `identity` (a tx hash, a payment id) plays its cue only once ever. */
export function fire(event: HapticEvent, options: { cue?: Cue; identity?: string } = {}): void {
  try {
    haptic(event)
    if (!options.cue) return
    if (options.identity) {
      const key = `${options.cue}:${options.identity}`
      if (played.has(key)) return
      played.add(key)
    }
    playCue(options.cue)
  } catch {
    // Feedback is decoration; the action never depends on it.
  }
}
