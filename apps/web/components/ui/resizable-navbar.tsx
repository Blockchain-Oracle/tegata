"use client"

// Aceternity UI "Resizable Navbar" (ui.aceternity.com/components/resizable-navbar), reskinned to Tegata's landing
// tokens: lucide icons in place of Tabler, washi plates instead of white/neutral, no fixed minimum width, and the
// capsule tightens to a content-sized pill once the page scrolls.
import { Menu, X } from "lucide-react"
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react"
import React, { useState } from "react"

import { cn } from "@/lib/utils"

interface NavbarProps {
  children: React.ReactNode
  className?: string
}

interface NavBodyProps {
  children: React.ReactNode
  className?: string
  visible?: boolean
}

interface NavItemsProps {
  items: { name: string; link: string }[]
  className?: string
  onItemClick?: () => void
}

interface MobileNavProps {
  children: React.ReactNode
  className?: string
  visible?: boolean
}

interface MobileNavMenuProps {
  children: React.ReactNode
  className?: string
  isOpen: boolean
  onClose: () => void
}

const SHADOW =
  "0 1px 0 0 color-mix(in oklab, var(--foreground) 6%, transparent), 0 12px 32px -12px color-mix(in oklab, var(--foreground) 22%, transparent)"

export const Navbar = ({ children, className }: NavbarProps) => {
  const { scrollY } = useScroll()
  const [visible, setVisible] = useState(false)
  useMotionValueEvent(scrollY, "change", (latest) => setVisible(latest > 80))

  return (
    <div className={cn("fixed inset-x-0 top-3 z-50 w-full px-3", className)}>
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child as React.ReactElement<{ visible?: boolean }>, { visible })
          : child,
      )}
    </div>
  )
}

export const NavBody = ({ children, className, visible }: NavBodyProps) => (
  <motion.div
    animate={{
      boxShadow: visible ? SHADOW : "0 0 0 0 transparent",
      width: visible ? "min(1010px, 100%)" : "min(1240px, 100%)",
      y: visible ? 6 : 0,
    }}
    transition={{ type: "spring", stiffness: 200, damping: 40 }}
    className={cn(
      "relative z-[60] mx-auto hidden flex-row items-center justify-between self-start rounded-full px-3 py-2 transition-colors duration-300 lg:flex",
      visible ? "bg-card/85 backdrop-blur-md" : "bg-transparent",
      className,
    )}
  >
    {children}
  </motion.div>
)

export const NavItems = ({ items, className, onItemClick }: NavItemsProps) => {
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <motion.div
      onMouseLeave={() => setHovered(null)}
      className={cn(
        "absolute inset-0 hidden flex-1 flex-row items-center justify-center gap-1 text-[15px] font-medium lg:flex",
        className,
      )}
    >
      {items.map((item, idx) => (
        <a
          onMouseEnter={() => setHovered(idx)}
          onClick={onItemClick}
          className="relative px-3.5 py-2 text-muted-foreground transition-colors hover:text-foreground"
          key={item.link}
          href={item.link}
        >
          {hovered === idx && (
            <motion.div
              layoutId="nav-hovered"
              className="absolute inset-0 size-full rounded-full bg-secondary"
              transition={{ type: "spring", stiffness: 500, damping: 36 }}
            />
          )}
          <span className="relative z-20">{item.name}</span>
        </a>
      ))}
    </motion.div>
  )
}

export const MobileNav = ({ children, className, visible }: MobileNavProps) => (
  <motion.div
    animate={{ boxShadow: visible ? SHADOW : "0 0 0 0 transparent", y: visible ? 4 : 0 }}
    transition={{ type: "spring", stiffness: 200, damping: 40 }}
    className={cn(
      "relative z-50 mx-auto flex w-full flex-col items-center justify-between rounded-[22px] px-3 py-2 transition-colors duration-300 lg:hidden",
      visible ? "bg-card/90 backdrop-blur-md" : "bg-transparent",
      className,
    )}
  >
    {children}
  </motion.div>
)

export const MobileNavHeader = ({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) => (
  <div className={cn("flex w-full flex-row items-center justify-between", className)}>
    {children}
  </div>
)

export const MobileNavMenu = ({ children, className, isOpen }: MobileNavMenuProps) => (
  <AnimatePresence>
    {isOpen && (
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.18 }}
        className={cn(
          "absolute inset-x-0 top-16 z-50 flex w-full flex-col items-start justify-start gap-2 rounded-[22px] bg-card p-4",
          className,
        )}
        style={{ boxShadow: SHADOW }}
      >
        {children}
      </motion.div>
    )}
  </AnimatePresence>
)

export const MobileNavToggle = ({ isOpen, onClick }: { isOpen: boolean; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    aria-label={isOpen ? "Close menu" : "Open menu"}
    aria-expanded={isOpen}
    className="grid size-11 place-items-center rounded-full text-foreground hover:bg-secondary"
  >
    {isOpen ? <X className="size-5" /> : <Menu className="size-5" />}
  </button>
)
