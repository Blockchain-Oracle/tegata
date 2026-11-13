// Tegata's tokens for the phone (DESIGN.md is the source; values match apps/web/app/globals.css). Light is the
// default; dark is an adaptation. The stage, the story fields and the seal keep their colours in both.
import { useColorScheme } from "react-native"

export const SHU = "#FF4F00"

const light = {
  page: "#F5F5F5",
  card: "#FFFFFF",
  plate: "#ECECEC",
  pressed: "#E2E2E2",
  ink: "#000000",
  text2: "#666666",
  text3: "#6E6E6E",
  primary: "#000000",
  onPrimary: "#FFFFFF",
  primaryPressed: "#252525",
  sealInk: "#B23700",
  sealWash: "#FFE9DF",
  up: "#2F7A00",
  down: "#C8283F",
  upSurface: "#EEF9DC",
  downSurface: "#FDE7EA",
  warn: "#8A5800",
  warnSurface: "#FFF0D5",
  skeleton: "#DEDEDE",
  scrim: "#000000B3",
  hairline: "#0000000F",
}

export type Palette = typeof light

const dark: Palette = {
  page: "#111111",
  card: "#1C1C1C",
  plate: "#292929",
  pressed: "#363636",
  ink: "#F5F5F5",
  text2: "#B8B8B8",
  text3: "#A0A0A0",
  primary: "#F5F5F5",
  onPrimary: "#000000",
  primaryPressed: "#DEDEDE",
  sealInk: "#FF8A52",
  sealWash: "#3A2015",
  up: "#B5F543",
  down: "#FF647C",
  upSurface: "#1E2A0C",
  downSurface: "#3A1A20",
  warn: "#F2B85C",
  warnSurface: "#332719",
  skeleton: "#363636",
  scrim: "#000000B3",
  hairline: "#FFFFFF14",
}

export function usePalette(): Palette {
  return useColorScheme() === "dark" ? dark : light
}

/** The lit stage's colours: the same in light and dark. */
export const STAGE = {
  base: SHU,
  hot: "#FF7A2E",
  glow: "#FFB38A",
  edge: "#FF3A00",
} as const

/** Story fields: colour for onboarding scenes, empty states and Home's tiles. */
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

export const RADIUS = { chip: 8, button: 12, row: 16, group: 20, sheet: 24, hero: 32, pill: 999 } as const
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

/** Elevation lives only on the dock, sheets and a receipt. */
export const SHADOW = {
  dock: { shadowColor: "#000", shadowOpacity: 0.2, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 12 },
  receipt: { shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: 8 }, elevation: 6 },
  object: { shadowColor: "#7A2400", shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 10 }, elevation: 10 },
} as const
