"use client"

// What any screen can open from the shell: the "Get paid" sheet, the scanner and the command menu.
import { createContext, useContext } from "react"

export interface ShellActions {
  openReceive: () => void
  openCommand: () => void
  openScan: () => void
}

export const ShellContext = createContext<ShellActions>({
  openReceive: () => undefined,
  openCommand: () => undefined,
  openScan: () => undefined,
})
export const useShell = () => useContext(ShellContext)
