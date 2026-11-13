"use client"

// A payroll invite followed from `/p/<token>`: kept for this tab, so sign-in and welcome know the person is joining a
// team ("What should we call you?") and come back to the page to finish choosing where pay lands.
const KEY = "tegata.payroll-invite"

export interface PayrollInvite {
  token: string
  business: string
  /** What the person picked before signing in, finished on their return. */
  choice: "tegata" | "near" | "chain"
  /** The NEAR account, or the address on another chain. */
  accountId?: string
  /** For another chain: the route ("usdt-tron"). */
  route?: string
}

export function rememberPayrollInvite(invite: PayrollInvite): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(invite))
  } catch {
    // Storage blocked: the person reopens their link after signing in.
  }
}

export function loadPayrollInvite(): PayrollInvite | null {
  try {
    const raw = sessionStorage.getItem(KEY)
    const value = raw ? (JSON.parse(raw) as PayrollInvite) : null
    return value && typeof value.token === "string" && typeof value.business === "string"
      ? value
      : null
  } catch {
    return null
  }
}

export function clearPayrollInvite(): void {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to clear.
  }
}
