"use client"

// The sheet (21st shadcn/drawer 1245 on vaul, Senryo's spec): from the bottom on a phone with a handle, as a right
// drawer on a desktop window. In 480 ms, out 240 ms on the drawer curve; opening and closing say so with a sound.
import { useEffect, useRef, useState } from "react"
import { Drawer } from "vaul"

import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

const DESKTOP = "(min-width: 1024px)"

function useDesktop() {
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const query = window.matchMedia(DESKTOP)
    const update = () => setDesktop(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])
  return desktop
}

export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  children: React.ReactNode
  className?: string
}) {
  const desktop = useDesktop()
  const was = useRef(open)
  useEffect(() => {
    if (open === was.current) return
    was.current = open
    fire("tick", { cue: open ? "sheetOpen" : "sheetClose" })
  }, [open])

  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} direction={desktop ? "right" : "bottom"}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <Drawer.Content
          aria-describedby={undefined}
          className={cn(
            "fixed z-50 flex flex-col bg-popover text-popover-foreground outline-none",
            desktop
              ? "top-4 right-4 bottom-4 w-[420px] rounded-[24px] shadow-sheet"
              : "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-[24px] shadow-sheet",
            className,
          )}
        >
          {!desktop ? (
            <div aria-hidden className="mx-auto mt-3.5 h-1 w-9 rounded-full bg-text-3/50" />
          ) : null}
          <Drawer.Title className="px-5 pt-5 text-center text-sheet-title font-semibold lg:text-left">
            {title}
          </Drawer.Title>
          <div className="flex-1 overflow-y-auto p-5">{children}</div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
