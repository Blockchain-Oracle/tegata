"use client"

// Route change inside the app: the page fades up 8 px in 240 ms (plan 6.5). Reduced motion: a plain fade.
import { motion, useReducedMotion } from "motion/react"

export default function AppTemplate({ children }: { children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.div
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
    >
      {children}
    </motion.div>
  )
}
