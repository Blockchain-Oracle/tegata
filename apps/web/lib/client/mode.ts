"use client"

// The mode the person chose: a cookie the server reads on every request (`lib/server/mode.ts`).
import type { NetworkId } from "@tegata/config"

export type Mode = "sandbox" | "live"
const COOKIE = "tegata-mode"
const YEAR_S = 31_536_000

export function readMode(): Mode {
  return typeof document !== "undefined" &&
    /(?:^|;\s*)tegata-mode=live(?:;|$)/.test(document.cookie)
    ? "live"
    : "sandbox"
}

/** Switch and reload, so every screen and query reads the other network from the start. */
export function switchMode(mode: Mode): void {
  // biome-ignore lint/suspicious/noDocumentCookie: one fixed, non-secret preference read by the server on each request.
  document.cookie = `${COOKIE}=${mode}; Path=/; Max-Age=${YEAR_S}; SameSite=Lax`
  window.location.reload()
}

/** The network a mode means, given the networks the server has switched on. */
export const networkFor = (mode: Mode, networks: readonly NetworkId[]): NetworkId =>
  mode === "live" && networks.includes("mainnet") ? "mainnet" : "testnet"
