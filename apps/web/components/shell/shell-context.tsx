"use client"

// What any screen can open from the shell: the "Get paid" sheet and the command menu.
import { createContext, useContext } from "react"

export interface ShellActions {
  openReceive: () => void
  openCommand: () => void
}

export const ShellContext = createContext<ShellActions>({
  openReceive: () => undefined,
  openCommand: () => undefined,
})
export const useShell = () => useContext(ShellContext)
