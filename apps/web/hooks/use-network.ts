"use client"

import type { NetworkId } from "@tegata/config"
import { useEffect, useState } from "react"

import { networkFor, readMode } from "@/lib/client/mode"

import { useProfile } from "./use-profile"

/** The network this screen works on: Live (mainnet) only when the server has it on and the person chose it. */
export function useNetwork(): NetworkId {
  const { profile } = useProfile()
  const [mode, setMode] = useState<"sandbox" | "live">("sandbox")
  useEffect(() => setMode(readMode()), [])
  return networkFor(mode, profile?.networks ?? ["testnet"])
}
