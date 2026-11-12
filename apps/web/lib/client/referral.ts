"use client"

// The invite a person arrived with (from /join/<handle>), kept on this device until they open their account.
const KEY = "tegata.ref.v1"
const KEEP_MS = 30 * 86_400_000

export interface Invite {
  handle: string
  business: string
  at: number
}

export function rememberInvite(invite: Omit<Invite, "at">): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...invite, at: Date.now() }))
  } catch {
    // Storage blocked: they can type the handle on the Refer page later.
  }
}

export function loadInvite(): Invite | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const invite = JSON.parse(raw) as Invite
    return Date.now() - invite.at < KEEP_MS ? invite : null
  } catch {
    return null
  }
}

export function clearInvite(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
