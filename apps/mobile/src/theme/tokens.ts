// Tegata's tokens for the phone (DESIGN.md is the source; values match apps/web/app/globals.css). Light is the
// default; dark is an adaptation. The stage, the story fields and the seal keep their colours in both.
import { useColorScheme } from "react-native"

export const SHU = "#FF4F00"

const light = {
  page: "#F3EFE6",
  card: "#FFFCF6",
  plate: "#E9E3D6",
  pressed: "#DFD8C9",
  ink: "#16130F",
  text2: "#5B544A",
  text3: "#6B6357",
  primary: "#16130F",
  onPrimary: "#FFFCF6",
  primaryPressed: "#2B2620",
  sealInk: "#B23700",
  sealWash: "#FFE6D6",
  up: "#2F7A00",
  down: "#C8283F",
  upSurface: "#ECF5D8",
  downSurface: "#FDECEB",
  warn: "#8A5800",
  warnSurface: "#FBEBCB",
  skeleton: "#E2DBCD",
  scrim: "#16130FB3",
  rule: "#DCD4C4",
  /** Text on a story field: sumi by day, washi at night (the fields go deep). */
  fieldInk: "#16130F",
  matcha: "#C8F06A",
  sora: "#A9D8FF",
  sakura: "#FFC2D6",
  kin: "#FFD23F",
}

export type Palette = typeof light

const dark: Palette = {
  page: "#0E0C0A",
  card: "#1B1814",
  plate: "#262119",
  pressed: "#2E2820",
  ink: "#F2EDE4",
  text2: "#B8AFA2",
  text3: "#968C7F",
  primary: "#F2EDE4",
  onPrimary: "#0E0C0A",
  primaryPressed: "#DCD5CA",
  sealInk: "#FF8A52",
  sealWash: "#3A2015",
  up: "#B5F543",
  down: "#FF647C",
  upSurface: "#1E2A0C",
  downSurface: "#3A1A20",
  warn: "#F2B85C",
  warnSurface: "#332719",
  skeleton: "#2A251F",
  scrim: "#000000B3",
  rule: "#2C2620",
  fieldInk: "#F2EDE4",
  matcha: "#1F2D0B",
  sora: "#142A40",
  sakura: "#3A1D2B",
  kin: "#3A2C0C",
}

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light
}

/** Paper: receipts, slips and every object on a stage. Paper stays paper in dark mode. */
export const PAPER = {
  face: "#FFFCF6",
  sunk: "#F3EFE6",
  rule: "#E9E3D6",
  ink: "#16130F",
  text2: "#5B544A",
  text3: "#6B6357",
  up: "#2F7A00",
  upSurface: "#ECF5D8",
} as const

/** The lit stage's colours: the same in light and dark. */
export const STAGE = {
  base: SHU,
  hot: "#FF7A2E",
  glow: "#FFB38A",
  edge: "#FF3A00",
} as const

/** Text and quiet plates on a lit stage (shu or lacquer): white figures, a veil for small controls. */
export const ON_STAGE = {
  ink: "#FFFFFF",
  soft: "#FFFFFFD9",
  faint: "#FFFFFF99",
  veil: "#FFFFFF2E",
} as const

/** The lacquer stage: sumi lit by one vermilion glow rising from below (sign-in, onboarding, big surfaces). */
export const LACQUER = {
  base: "#120D0A",
  glow: "#FF4F00",
  glow2: "#FF6A1A",
  rim: "#FF7A2E",
} as const

/** Story fields at their daylight hues (stage objects and fixed art). In the app use the palette's fields, which go
 * deep at night. */
export const STORY = {
  matcha: "#C8F06A",
  sora: "#A9D8FF",
  sakura: "#FFC2D6",
  kin: "#FFD23F",
  ai: "#1B1F5E",
} as const

/** Font families as loaded by the expo-font plugin (their PostScript names). */
export const FONT = {
  display: "Archivo-ExtraCondensedBlack",
  regular: "Archivo-Regular",
  medium: "Archivo-Medium",
  semibold: "Archivo-SemiBold",
  bold: "Archivo-Bold",
  mono: "DMMono-Regular",
  monoMedium: "DMMono-Medium",
} as const

/** Type roles (DESIGN.md "Type"). Display roles are the condensed money cut. */
export const TYPE = {
  hero: { fontFamily: FONT.display, fontSize: 64, lineHeight: 66 },
  balance: { fontFamily: FONT.display, fontSize: 56, lineHeight: 58 },
  price: { fontFamily: FONT.display, fontSize: 40, lineHeight: 44 },
  pageTitle: { fontFamily: FONT.display, fontSize: 34, lineHeight: 38 },
  stepTitle: { fontFamily: FONT.semibold, fontSize: 28, lineHeight: 34, letterSpacing: -0.56 },
  sheetTitle: { fontFamily: FONT.semibold, fontSize: 24, lineHeight: 28 },
  sectionTitle: { fontFamily: FONT.semibold, fontSize: 20, lineHeight: 24 },
  rowTitle: { fontFamily: FONT.semibold, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: FONT.regular, fontSize: 16, lineHeight: 22 },
  bodyMedium: { fontFamily: FONT.medium, fontSize: 16, lineHeight: 22 },
  detail: { fontFamily: FONT.regular, fontSize: 14, lineHeight: 18 },
  detailMedium: { fontFamily: FONT.medium, fontSize: 14, lineHeight: 18 },
  meta: { fontFamily: FONT.medium, fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: FONT.mono, fontSize: 15, lineHeight: 20 },
} as const

export const RADIUS = {
  chip: 8,
  button: 12,
  row: 16,
  group: 20,
  sheet: 24,
  hero: 32,
  pill: 999,
} as const
export const SPACE = { xs: 4, s: 8, m: 12, l: 16, xl: 20, xxl: 24, x3: 32, x4: 48 } as const

/** Motion (DESIGN.md "Motion"), in ms and spring configs for Reanimated. */
export const MOTION = {
  pressIn: 100,
  pressOut: 160,
  selection: 170,
  roll: 260,
  stepOut: 160,
  stepIn: 320,
  stagger: 40,
  sheetIn: 480,
  seal: 220,
  skeleton: 1200,
} as const

export const SPRING = {
  selector: { stiffness: 260, damping: 30, mass: 1 },
  pill: { stiffness: 500, damping: 36, mass: 1 },
  press: { stiffness: 600, damping: 30, mass: 1 },
  layout: { stiffness: 420, damping: 40, mass: 1 },
  dock: { stiffness: 420, damping: 30, mass: 1 },
} as const

/** Elevation lives only on the dock, sheets and a receipt. Shadows are warm sumi, never neutral black. */
export const SHADOW = {
  dock: {
    shadowColor: "#16130F",
    shadowOpacity: 0.24,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 10 },
    elevation: 12,
  },
  receipt: {
    shadowColor: "#16130F",
    shadowOpacity: 0.2,
    shadowRadius: 17,
    shadowOffset: { width: 0, height: 14 },
    elevation: 6,
  },
  object: {
    shadowColor: "#7A2400",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
} as const
