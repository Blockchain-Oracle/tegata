"use client"

// An invoice built before signing in (plan 6.8 K, guest mode): kept on this device only, then picked up after
// sign-in and saved as a real draft. Nothing leaves the browser until the person has an account.
import type { DraftForm } from "@/lib/client/types"

const KEY = "tegata.guest-invoice.v1"

export interface GuestCustomer {
  name: string
  email: string
  address: string
  taxId: string
}

export interface GuestDraft {
  business: string
  customer: GuestCustomer | null
  form: DraftForm
}

export function saveGuestDraft(draft: GuestDraft): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    // Storage blocked: the draft lives only in this page.
  }
}

export function loadGuestDraft(): GuestDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as GuestDraft) : null
  } catch {
    return null
  }
}

export function clearGuestDraft(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
