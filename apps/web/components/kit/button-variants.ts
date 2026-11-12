// Button styles, usable from server components (the landing page styles links as buttons).
import { cva } from "class-variance-authority"

export const buttonVariants = cva(
  "press relative inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-semibold transition-colors duration-150 disabled:pointer-events-none aria-disabled:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-primary text-primary-foreground hover:bg-primary-pressed active:bg-primary-pressed",
        secondary: "bg-secondary text-secondary-foreground hover:bg-plate-pressed",
        shu: "bg-shu text-black hover:brightness-[1.06]",
        ghost: "bg-transparent text-foreground hover:bg-secondary",
        destructive: "bg-down-surface text-down hover:brightness-95",
        /** On the vermilion stage: a white plate with ink text. */
        paper: "bg-white text-black hover:bg-white/90",
        /** On the vermilion stage: a quiet translucent plate. */
        veil: "bg-white/18 text-white hover:bg-white/26 backdrop-blur-sm",
      },
      size: {
        lg: "h-14 rounded-[14px] px-6 text-button [&_svg]:size-5",
        md: "h-12 rounded-[12px] px-5 text-[16px] [&_svg]:size-[18px]",
        sm: "h-10 rounded-[10px] px-4 text-[15px] [&_svg]:size-4",
        icon: "size-11 rounded-full [&_svg]:size-5",
        iconSm: "size-9 rounded-full [&_svg]:size-4",
      },
      block: { true: "w-full" },
    },
    compoundVariants: [
      {
        variant: ["primary", "secondary", "shu", "paper"],
        className: "disabled:bg-input disabled:text-text-3",
      },
    ],
    defaultVariants: { variant: "primary", size: "lg" },
  },
)
