// The 3D hanko (DESIGN.md, "The 3D hanko"). Two scenes on one desk:
// - "invoice" (the landing hero): Tegata's square company seal over a $1,250 bill, the coins a client can pay from in
//   orbit. Once after load it turns face-down and presses: the coins pour into the bill, the ink is left behind and
//   the bill turns Paid. Clicking the seal presses again.
// - "welcome" (onboarding): the business's own round seal, cut on the hanko's face as its name is typed, over its
//   bill of exchange ("Pay to the order of…"). When the account opens the seal presses the bill.
// Framework-free three.js so React only mounts and disposes it; loaded after first paint.
import * as THREE from "three"
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js"
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js"
import { SVGLoader } from "three/examples/jsm/loaders/SVGLoader.js"

import { GLYPH_BOX, SEAL_FACES } from "@/lib/brand/glyphs"

export interface HankoCoin {
  /** A mark id in public/marks. */
  coin: string
  /** The chain's mark, drawn as a badge (omitted when the coin is the chain's own). */
  chain?: string
}

export interface HankoOptions {
  coins: readonly HankoCoin[]
  /** Fonts read from the page's CSS variables, so the bill matches the site. */
  fonts: { sans: string; mono: string }
  /** Called the moment the seal touches the bill (the bill has already turned Paid). */
  onContact?: (byUser: boolean) => void
  /** Skip the automatic first press (reduced motion still shows the stamped end state). */
  autoPress?: boolean
  mode?: "invoice" | "welcome"
  /** For "welcome": what the bill and the round seal say. */
  welcome?: WelcomeBill
  /** Light the scene for a dark field whatever the page theme (the lacquer stage). */
  night?: boolean
}

export interface WelcomeBill {
  name: string
  account: string
  /** "13 Nov". */
  date: string
  open: boolean
}

const SHU = "#FF4F00"
const INK = "#16130F"
const PAPER = "#FFFCF6"

/* ------------------------------------------------------------------------------------------------ */
/* The seal's face: the real 手形 outlines, fitted the same way as <TegataSeal>.                       */
/* ------------------------------------------------------------------------------------------------ */

const VIEW = 200
type Box = readonly [number, number, number, number]

function fit(box: Box, x: number, y: number, w: number, h: number) {
  const [x1, y1, x2, y2] = box
  const s = Math.min(w / (x2 - x1), h / (y2 - y1))
  const tx = x + (w - (x2 - x1) * s) / 2 - x1 * s
  const ty = y + (h - (y2 - y1) * s) / 2 - y1 * s
  return { tx, ty, s }
}

/** The seal face as SVG markup in a 200-unit box: the inner rule and the two glyphs (no field). */
function faceSvg(withField: boolean, fieldColour: string, glyphColour: string, ink: boolean) {
  const g = SEAL_FACES.shippori.glyphs
  const pad = 30
  const cellH = (VIEW - pad * 2 - 6) / 2
  const a = fit(g.手.box, pad, pad - 2, VIEW - pad * 2, cellH)
  const b = fit(g.形.box, pad, pad + cellH + 8, VIEW - pad * 2, cellH)
  const filter = ink
    ? `<filter id="i" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="0.62" numOctaves="2" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 -17 13.2" result="h"/><feComposite in="SourceGraphic" in2="h" operator="in" result="s"/><feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="3" result="w"/><feDisplacementMap in="s" in2="w" scale="1.8" xChannelSelector="R" yChannelSelector="G"/></filter>`
    : ""
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${VIEW} ${VIEW}" width="512" height="512"><defs>${filter}</defs><g${ink ? ' filter="url(#i)"' : ""}>${
    withField
      ? `<rect x="6" y="6" width="${VIEW - 12}" height="${VIEW - 12}" rx="30" fill="${fieldColour}"/>`
      : ""
  }<rect x="18" y="18" width="${VIEW - 36}" height="${VIEW - 36}" rx="20" fill="none" stroke="${glyphColour}" stroke-width="5"/><path fill="${glyphColour}" transform="translate(${a.tx} ${a.ty}) scale(${a.s})" d="${g.手.d}"/><path fill="${glyphColour}" transform="translate(${b.tx} ${b.ty}) scale(${b.s})" d="${g.形.d}"/></g></svg>`
}

function loadImage(src: string, size = 512): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image(size, size)
    img.decoding = "async"
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

const svgUrl = (svg: string) => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`

/** Shapes for the carved relief: the rule ring and the glyphs, in the 200-unit box, y down. */
function reliefShapes(): THREE.Shape[] {
  const g = SEAL_FACES.shippori.glyphs
  const pad = 30
  const cellH = (VIEW - pad * 2 - 6) / 2
  const a = fit(g.手.box, pad, pad - 2, VIEW - pad * 2, cellH)
  const b = fit(g.形.box, pad, pad + cellH + 8, VIEW - pad * 2, cellH)
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path transform="translate(${a.tx} ${a.ty}) scale(${a.s})" d="${g.手.d}"/><path transform="translate(${b.tx} ${b.ty}) scale(${b.s})" d="${g.形.d}"/></svg>`
  const data = new SVGLoader().parse(svg)
  const shapes: THREE.Shape[] = []
  for (const path of data.paths) shapes.push(...path.toShapes())
  // The inner rule: a rounded square ring 5 units wide.
  shapes.push(roundedRing(18, 18, VIEW - 36, VIEW - 36, 20, 5))
  return shapes
}

function roundedRectPath(p: THREE.Path, x: number, y: number, w: number, h: number, r: number) {
  p.moveTo(x + r, y)
  p.lineTo(x + w - r, y)
  p.quadraticCurveTo(x + w, y, x + w, y + r)
  p.lineTo(x + w, y + h - r)
  p.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  p.lineTo(x + r, y + h)
  p.quadraticCurveTo(x, y + h, x, y + h - r)
  p.lineTo(x, y + r)
  p.quadraticCurveTo(x, y, x + r, y)
}

function roundedRing(x: number, y: number, w: number, h: number, r: number, t: number) {
  const outer = new THREE.Shape()
  roundedRectPath(outer, x - t / 2, y - t / 2, w + t, h + t, r + t / 2)
  const inner = new THREE.Path()
  roundedRectPath(inner, x + t / 2, y + t / 2, w - t, h - t, r - t / 2)
  outer.holes.push(inner)
  return outer
}

/* ------------------------------------------------------------------------------------------------ */
/* Easing.                                                                                          */
/* ------------------------------------------------------------------------------------------------ */

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const span = (t: number, a: number, b: number) => clamp01((t - a) / (b - a))
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeIn = (t: number) => t * t * t
const easeOut = (t: number) => 1 - (1 - t) ** 3

/* ------------------------------------------------------------------------------------------------ */
/* The bill, drawn on a canvas so it shares the scene's light and perspective.                      */
/* ------------------------------------------------------------------------------------------------ */

const BILL_W = 3.2
const BILL_H = 4.2
const BILL_PX_W = 1200
const BILL_PX_H = Math.round((BILL_PX_W * BILL_H) / BILL_W)
/** Where the seal lands, in bill pixels (lower right, over the totals, the way a real stamp sits). */
const STAMP_PX = { x: 860, y: 1170 }
const SEAL_SIZE = 1.18

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

function setFont(ctx: CanvasRenderingContext2D, font: string, condensed = false) {
  ctx.font = font
  // Archivo's width axis: 62 is the display cut. Older engines ignore this and draw the normal width.
  ;(ctx as CanvasRenderingContext2D & { fontStretch?: string }).fontStretch = condensed
    ? "extra-condensed"
    : "normal"
}

function drawBill(
  ctx: CanvasRenderingContext2D,
  paid: boolean,
  fonts: HankoOptions["fonts"],
  mark: HTMLImageElement,
  usdc: HTMLImageElement,
  near: HTMLImageElement,
) {
  const W = BILL_PX_W
  const H = BILL_PX_H
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  const L = 96
  const R = W - 96
  ctx.textBaseline = "alphabetic"

  // Header: the Tegata mark and the bill's number.
  ctx.drawImage(mark, L, 86, 64, 64)
  ctx.fillStyle = "#5B544A"
  setFont(ctx, `600 46px ${fonts.sans}`)
  ctx.textAlign = "left"
  ctx.fillText("Invoice · INV-0001", L + 88, 134)

  // Status chip.
  setFont(ctx, `700 42px ${fonts.sans}`)
  const label = paid ? "Paid" : "Sent"
  const tw = ctx.measureText(label).width
  const chipW = tw + (paid ? 108 : 64)
  roundRect(ctx, R - chipW, 82, chipW, 72, 36)
  ctx.fillStyle = paid ? "#EEF9DC" : "#E9E3D6"
  ctx.fill()
  ctx.fillStyle = paid ? "#2F7A00" : "#5B544A"
  if (paid) {
    ctx.lineWidth = 7
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#2F7A00"
    ctx.beginPath()
    ctx.moveTo(R - chipW + 34, 120)
    ctx.lineTo(R - chipW + 48, 134)
    ctx.lineTo(R - chipW + 72, 104)
    ctx.stroke()
    ctx.fillText(label, R - chipW + 84, 131)
  } else {
    ctx.fillText(label, R - chipW + 32, 131)
  }

  // The amount.
  ctx.fillStyle = "#6B6357"
  setFont(ctx, `500 44px ${fonts.sans}`)
  ctx.fillText(paid ? "Amount received" : "Amount due", L, 300)
  ctx.fillStyle = INK
  setFont(ctx, `900 210px ${fonts.sans}`, true)
  ctx.fillText("$1,250.00", L - 6, 500)

  if (paid) {
    ctx.drawImage(usdc, L, 548, 48, 48)
    ctx.fillStyle = "#2F7A00"
    setFont(ctx, `600 42px ${fonts.sans}`)
    ctx.fillText("Exactly, in USDC on NEAR", L + 64, 586)
  } else {
    ctx.fillStyle = "#5B544A"
    setFont(ctx, `500 38px ${fonts.sans}`)
    ctx.fillText("Due 30 Nov · pay from any coin", L, 584)
  }

  // A rule, the line, a rule.
  ctx.fillStyle = "#E9E3D6"
  ctx.fillRect(L, 660, R - L, 4)
  ctx.fillStyle = INK
  setFont(ctx, `500 40px ${fonts.sans}`)
  ctx.fillText("Brand and website design", L, 760)
  ctx.textAlign = "right"
  ctx.fillText("$1,250.00", R, 760)
  ctx.textAlign = "left"
  ctx.fillStyle = "#6B6357"
  setFont(ctx, `500 34px ${fonts.sans}`)
  ctx.fillText("1 × $1,250.00", L, 812)
  ctx.fillStyle = "#E9E3D6"
  ctx.fillRect(L, 880, R - L, 4)

  // Who it's from.
  ctx.fillStyle = "#6B6357"
  setFont(ctx, `500 34px ${fonts.sans}`)
  ctx.fillText("Pay to", L, 980)
  ctx.drawImage(near, L, 1004, 46, 46)
  ctx.fillStyle = INK
  setFont(ctx, `500 38px ${fonts.mono}`)
  ctx.fillText("studio.tegata.near", L + 62, 1040)

  // Footer.
  ctx.fillStyle = "#6B6357"
  setFont(ctx, `500 32px ${fonts.sans}`)
  ctx.fillText("Checked on NEAR before it says paid", L, H - 110)
}

/** The bill of exchange a new business is issued: its name, its pay address, and "Open" once the seal lands. */
function drawWelcomeBill(
  ctx: CanvasRenderingContext2D,
  w: WelcomeBill,
  fonts: HankoOptions["fonts"],
  mark: HTMLImageElement,
  near: HTMLImageElement,
) {
  const W = BILL_PX_W
  const H = BILL_PX_H
  ctx.clearRect(0, 0, W, H)
  ctx.fillStyle = PAPER
  ctx.fillRect(0, 0, W, H)
  const L = 96
  const R = W - 96
  ctx.textBaseline = "alphabetic"
  ctx.textAlign = "left"

  ctx.drawImage(mark, L, 86, 64, 64)
  ctx.fillStyle = "#5B544A"
  setFont(ctx, `600 46px ${fonts.sans}`)
  ctx.fillText("Tegata", L + 88, 134)

  // Status: a draft until the seal lands.
  setFont(ctx, `700 42px ${fonts.sans}`)
  const label = w.open ? "Open" : w.date
  const tw = ctx.measureText(label).width
  const chipW = tw + (w.open ? 108 : 64)
  roundRect(ctx, R - chipW, 82, chipW, 72, 36)
  ctx.fillStyle = w.open ? "#EEF9DC" : "#E9E3D6"
  ctx.fill()
  ctx.fillStyle = w.open ? "#2F7A00" : "#5B544A"
  if (w.open) {
    ctx.lineWidth = 7
    ctx.lineCap = "round"
    ctx.lineJoin = "round"
    ctx.strokeStyle = "#2F7A00"
    ctx.beginPath()
    ctx.moveTo(R - chipW + 34, 120)
    ctx.lineTo(R - chipW + 48, 134)
    ctx.lineTo(R - chipW + 72, 104)
    ctx.stroke()
    ctx.fillText(label, R - chipW + 84, 131)
  } else {
    ctx.fillText(label, R - chipW + 32, 131)
  }

  ctx.fillStyle = "#6B6357"
  setFont(ctx, `500 44px ${fonts.sans}`)
  ctx.fillText("Pay to the order of", L, 300)

  // The name, as large as the line allows.
  const name = w.name.trim() || "Your business"
  let size = 196
  setFont(ctx, `900 ${size}px ${fonts.sans}`, true)
  while (size > 84 && ctx.measureText(name).width > R - L) {
    size -= 6
    setFont(ctx, `900 ${size}px ${fonts.sans}`, true)
  }
  ctx.fillStyle = w.name.trim() ? INK : "#B5AD9F"
  ctx.fillText(name, L - 4, 470)

  ctx.fillStyle = "#E9E3D6"
  ctx.fillRect(L, 560, R - L, 4)

  ctx.fillStyle = "#6B6357"
  setFont(ctx, `500 38px ${fonts.sans}`)
  ctx.fillText("Pay address", L, 660)
  ctx.drawImage(near, L, 690, 54, 54)
  let mono = 44
  setFont(ctx, `500 ${mono}px ${fonts.mono}`)
  while (mono > 26 && ctx.measureText(w.account).width > R - L - 74) {
    mono -= 2
    setFont(ctx, `500 ${mono}px ${fonts.mono}`)
  }
  ctx.fillStyle = INK
  ctx.fillText(w.account, L + 72, 732)

  if (w.open) {
    ctx.fillStyle = "#6B6357"
    setFont(ctx, `500 38px ${fonts.sans}`)
    ctx.fillText("Balance", L, 860)
    ctx.fillStyle = INK
    setFont(ctx, `900 130px ${fonts.sans}`, true)
    ctx.fillText("$0.00", L - 4, 990)
  }

  ctx.fillStyle = "#6B6357"
  setFont(ctx, `500 32px ${fonts.sans}`)
  ctx.fillText("Anyone can pay you, from any chain", L, H - 110)
}

const monogram = (name: string) => {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return "T"
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase()
  return words
    .slice(0, 3)
    .map((x) => x[0]!.toUpperCase())
    .join("")
}

/** The business's round seal (丸印), drawn the way <BusinessSeal> draws it: the name around the ring, a monogram
 *  or a band in the middle, vermilion with a few specks where the ink didn't take. */
function drawRoundSeal(
  canvas: HTMLCanvasElement,
  name: string,
  fonts: HankoOptions["fonts"],
  opts: { band?: string; face?: boolean },
) {
  const size = canvas.width
  const ctx = canvas.getContext("2d")!
  ctx.save()
  ctx.clearRect(0, 0, size, size)
  const c = size / 2
  if (opts.face) {
    // The carved face seen from below: recesses dark, mirrored top to bottom so its print reads true.
    ctx.fillStyle = "#2A1610"
    ctx.beginPath()
    ctx.arc(c, c, c, 0, Math.PI * 2)
    ctx.fill()
    ctx.translate(0, size)
    ctx.scale(1, -1)
  }
  ctx.strokeStyle = SHU
  ctx.fillStyle = SHU
  ctx.lineWidth = size * 0.036
  ctx.beginPath()
  ctx.arc(c, c, size * 0.455, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = size * 0.016
  ctx.beginPath()
  ctx.arc(c, c, size * 0.285, 0, Math.PI * 2)
  ctx.stroke()

  const ring = `${name.trim() || "Your business"} · TEGATA · `.toUpperCase()
  const chars = Array.from(ring)
  setFont(ctx, `800 ${Math.round(size * 0.078)}px ${fonts.sans}`)
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"
  const r = size * 0.365
  chars.forEach((ch, i) => {
    const a = -Math.PI / 2 + (i / chars.length) * Math.PI * 2
    ctx.save()
    ctx.translate(c + Math.cos(a) * r, c + Math.sin(a) * r)
    ctx.rotate(a + Math.PI / 2)
    ctx.fillText(ch, 0, 0)
    ctx.restore()
  })

  if (opts.band) {
    const bw = size * 0.64
    const bh = size * 0.16
    roundRect(ctx, c - bw / 2, c - bh / 2, bw, bh, size * 0.02)
    ctx.fill()
    ctx.fillStyle = "#FFFFFF"
    let fs = Math.round(size * 0.095)
    setFont(ctx, `900 ${fs}px ${fonts.sans}`, true)
    while (fs > 20 && ctx.measureText(opts.band.toUpperCase()).width > bw - size * 0.06) {
      fs -= 2
      setFont(ctx, `900 ${fs}px ${fonts.sans}`, true)
    }
    ctx.fillText(opts.band.toUpperCase(), c, c + size * 0.006)
  } else {
    const m = monogram(name)
    setFont(ctx, `900 ${Math.round(size * (m.length > 2 ? 0.2 : 0.26))}px ${fonts.sans}`, true)
    ctx.fillText(m, c, c + size * 0.01)
  }

  // Specks where the ink didn't take, the same every time.
  ctx.globalCompositeOperation = "destination-out"
  let seed = 7
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return seed / 2147483647
  }
  for (let i = 0; i < 260; i++) {
    ctx.beginPath()
    ctx.arc(rand() * size, rand() * size, 0.6 + rand() * 1.8, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

/* ------------------------------------------------------------------------------------------------ */
/* Soft shapes for shadows and ink.                                                                  */
/* ------------------------------------------------------------------------------------------------ */

function radialTexture(inner: number, outer: number) {
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const ctx = c.getContext("2d")!
  const g = ctx.createRadialGradient(128, 128, inner, 128, 128, outer)
  g.addColorStop(0, "rgba(0,0,0,1)")
  g.addColorStop(1, "rgba(0,0,0,0)")
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 256, 256)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function squareShadowTexture() {
  const c = document.createElement("canvas")
  c.width = c.height = 256
  const ctx = c.getContext("2d")!
  ctx.filter = "blur(22px)"
  ctx.fillStyle = "#000"
  ctx.fillRect(56, 56, 144, 144)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

async function coinTexture(coin: HankoCoin) {
  const size = 256
  const c = document.createElement("canvas")
  c.width = c.height = size
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#FFFFFF"
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()
  try {
    const img = await loadImage(`/marks/${coin.coin}.svg`, size)
    ctx.save()
    ctx.beginPath()
    ctx.arc(size / 2, size / 2, size / 2 - 2, 0, Math.PI * 2)
    ctx.clip()
    ctx.drawImage(img, 0, 0, size, size)
    ctx.restore()
    if (coin.chain && coin.chain !== coin.coin) {
      const badge = await loadImage(`/marks/${coin.chain}.svg`, 96)
      const bs = 92
      const bx = size - bs - 4
      const by = size - bs - 4
      ctx.fillStyle = "#FFFFFF"
      ctx.beginPath()
      ctx.arc(bx + bs / 2, by + bs / 2, bs / 2 + 7, 0, Math.PI * 2)
      ctx.fill()
      ctx.save()
      ctx.beginPath()
      ctx.arc(bx + bs / 2, by + bs / 2, bs / 2, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(badge, bx, by, bs, bs)
      ctx.restore()
    }
  } catch {
    // A missing mark leaves a plain coin.
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

/* ------------------------------------------------------------------------------------------------ */
/* The scene.                                                                                        */
/* ------------------------------------------------------------------------------------------------ */

interface Coin {
  group: THREE.Group
  phase: number
  flip: number
}

export class HankoScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera = new THREE.PerspectiveCamera(28, 1, 0.1, 100)
  private root = new THREE.Group()
  private hanko = new THREE.Group()
  private hankoBody = new THREE.Group()
  private bill = new THREE.Group()
  private billCanvas = document.createElement("canvas")
  private billTexture: THREE.CanvasTexture
  private ink!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private contact!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>
  private rimLight = new THREE.PointLight("#FF5A1F", 18, 20, 2)
  private coins: Coin[] = []
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2(0, 0)
  private parallax = new THREE.Vector2(0, 0)
  private t0 = performance.now()
  private frame = 0
  private running = false
  private disposed = false
  private paid = false
  /** `start` is set by the first frame drawn after the press is asked for, so a press asked for in a hidden tab
   * (onboarding waits seconds on NEAR) plays when the page is seen instead of passing unseen. */
  private press: { start: number | null; byUser: boolean; touched: boolean } | null = null
  private envTarget: THREE.WebGLRenderTarget | null = null
  private images!: { mark: HTMLImageElement; usdc: HTMLImageElement; near: HTMLImageElement }
  private stampWorld = new THREE.Vector3()
  private idlePos = new THREE.Vector3(0.95, 2.35, -0.25)
  private idleQuat = new THREE.Quaternion()
  private downQuat = new THREE.Quaternion()
  private ro: ResizeObserver
  private io: IntersectionObserver
  private visible = true
  private dark = false
  private bodyHeight = 1.5
  private welcome?: WelcomeBill
  private faceCanvas = document.createElement("canvas")
  private faceTexture?: THREE.CanvasTexture
  private inkCanvas = document.createElement("canvas")
  private inkTexture?: THREE.CanvasTexture

  constructor(
    private container: HTMLElement,
    private options: HankoOptions,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75))
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.05
    this.renderer.setClearColor(0x000000, 0)
    this.renderer.domElement.style.cssText =
      "width:100%;height:100%;display:block;touch-action:pan-y"
    container.appendChild(this.renderer.domElement)

    const pmrem = new THREE.PMREMGenerator(this.renderer)
    const room = new RoomEnvironment()
    this.envTarget = pmrem.fromScene(room, 0.04)
    this.scene.environment = this.envTarget.texture
    this.scene.environmentIntensity = 0.55
    room.dispose()
    pmrem.dispose()

    this.billCanvas.width = BILL_PX_W
    this.billCanvas.height = BILL_PX_H
    this.billTexture = new THREE.CanvasTexture(this.billCanvas)
    this.billTexture.colorSpace = THREE.SRGBColorSpace
    this.billTexture.anisotropy = this.renderer.capabilities.getMaxAnisotropy()

    this.scene.add(this.root)
    this.camera.position.set(0, 8.6, 8.2)
    this.camera.lookAt(0, 0.9, 0)

    this.lights()

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.io = new IntersectionObserver(([entry]) => {
      this.visible = !!entry?.isIntersecting
      if (this.visible) this.start()
    })
    this.io.observe(container)
    this.dark = !!options.night || document.documentElement.classList.contains("dark")
    this.welcome = options.welcome
    this.applyTheme()

    container.addEventListener("pointermove", this.onPointerMove)
    container.addEventListener("pointerleave", this.onPointerLeave)
    container.addEventListener("click", this.onClick)
  }

  /** Builds everything that needs images and fonts; resolves once the first frame can be drawn. */
  async init() {
    const [mark, usdc, near, inkImg] = await Promise.all([
      loadImage(svgUrl(faceSvg(true, SHU, "#FFFFFF", false)), 256),
      loadImage("/marks/usdc.svg", 96),
      loadImage("/marks/near.svg", 96),
      loadImage(svgUrl(faceSvg(true, SHU, PAPER, true)), 512),
    ])
    this.images = { mark, usdc, near }
    try {
      await Promise.all([
        document.fonts.load(`900 120px ${this.options.fonts.sans}`),
        document.fonts.load(`600 40px ${this.options.fonts.sans}`),
        document.fonts.load(`500 40px ${this.options.fonts.mono}`),
      ])
    } catch {
      // Fallback fonts still draw a readable bill.
    }
    if (this.disposed) return
    const welcome = this.options.mode === "welcome"
    let inkMap: THREE.Texture
    if (welcome) {
      this.inkCanvas.width = this.inkCanvas.height = 512
      this.inkTexture = new THREE.CanvasTexture(this.inkCanvas)
      this.inkTexture.colorSpace = THREE.SRGBColorSpace
      inkMap = this.inkTexture
    } else {
      inkMap = new THREE.Texture(inkImg)
      inkMap.colorSpace = THREE.SRGBColorSpace
      inkMap.needsUpdate = true
    }
    this.buildBill(inkMap)
    if (welcome) this.buildRoundHanko()
    else this.buildHanko()
    this.redrawWelcome()
    await this.buildCoins()
    if (this.disposed) return
    this.resize()
    const stamped = welcome ? !!this.welcome?.open : this.options.autoPress === false
    if (stamped) {
      this.setPaid(true)
      this.ink.material.opacity = 0.95
    }
    this.start()
    if (!welcome && this.options.autoPress !== false)
      window.setTimeout(() => this.pressSeal(false), 1500)
  }

  /** Onboarding: the name and pay address as they are typed. The seal on the hanko's face is re-cut each time. */
  setWelcome(w: WelcomeBill) {
    const wasOpen = this.welcome?.open
    this.welcome = { ...w, open: wasOpen ?? false }
    this.redrawWelcome()
    if (this.billTexture && this.images) this.setPaid(this.paid)
  }

  private redrawWelcome() {
    if (this.options.mode !== "welcome" || !this.welcome) return
    const w = this.welcome
    if (this.faceTexture) {
      drawRoundSeal(this.faceCanvas, w.name, this.options.fonts, { face: true })
      this.faceTexture.needsUpdate = true
    }
    if (this.inkTexture) {
      drawRoundSeal(this.inkCanvas, w.name, this.options.fonts, { band: `Open · ${w.date}` })
      this.inkTexture.needsUpdate = true
    }
  }

  private lights() {
    this.scene.add(new THREE.HemisphereLight("#FFF6EA", "#3A2A20", 0.9))
    const key = new THREE.DirectionalLight("#FFF3E6", 2.4)
    key.position.set(3.5, 9, 5)
    this.scene.add(key)
    const fill = new THREE.DirectionalLight("#DDE6FF", 0.5)
    fill.position.set(-6, 4, 3)
    this.scene.add(fill)
    this.rimLight.position.set(-1.5, 3.8, -3.2)
    this.scene.add(this.rimLight)
  }

  private drawCurrentBill(paid: boolean) {
    const ctx = this.billCanvas.getContext("2d")!
    if (this.options.mode === "welcome" && this.welcome)
      drawWelcomeBill(
        ctx,
        { ...this.welcome, open: paid },
        this.options.fonts,
        this.images.mark,
        this.images.near,
      )
    else
      drawBill(ctx, paid, this.options.fonts, this.images.mark, this.images.usdc, this.images.near)
    this.billTexture.needsUpdate = true
  }

  private buildBill(inkMap: THREE.Texture) {
    this.drawCurrentBill(false)

    // A soft shadow under the sheet, so it rests on the desk.
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(BILL_W * 1.5, BILL_H * 1.35),
      new THREE.MeshBasicMaterial({
        map: squareShadowTexture(),
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
      }),
    )
    shadow.rotation.x = -Math.PI / 2
    shadow.position.set(0.12, -0.02, 0.18)
    this.bill.add(shadow)

    const sheet = new THREE.Mesh(
      new THREE.PlaneGeometry(BILL_W, BILL_H),
      new THREE.MeshStandardMaterial({ map: this.billTexture, roughness: 0.92, metalness: 0 }),
    )
    sheet.rotation.x = -Math.PI / 2
    this.bill.add(sheet)

    // Where the stamp lands, in the sheet's own plane.
    const sx = (STAMP_PX.x / BILL_PX_W - 0.5) * BILL_W
    const sz = (STAMP_PX.y / BILL_PX_H - 0.5) * BILL_H

    this.ink = new THREE.Mesh(
      new THREE.PlaneGeometry(SEAL_SIZE, SEAL_SIZE),
      new THREE.MeshBasicMaterial({
        map: inkMap,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    )
    this.ink.rotation.x = -Math.PI / 2
    this.ink.rotation.z = THREE.MathUtils.degToRad(-6)
    this.ink.position.set(sx, 0.004, sz)
    this.bill.add(this.ink)

    this.contact = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: radialTexture(10, 128),
        transparent: true,
        opacity: 0,
        depthWrite: false,
      }),
    )
    this.contact.rotation.x = -Math.PI / 2
    this.contact.position.y = 0.006
    this.bill.add(this.contact)

    this.bill.rotation.y = THREE.MathUtils.degToRad(-9)
    this.bill.position.set(-0.35, 0, 0.35)
    this.root.add(this.bill)
    this.bill.updateMatrixWorld(true)
    this.stampWorld.copy(this.ink.getWorldPosition(new THREE.Vector3()))
  }

  private buildHanko() {
    const S = SEAL_SIZE
    const H = this.bodyHeight
    const horn = new THREE.MeshPhysicalMaterial({
      color: "#15110E",
      roughness: 0.32,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      sheen: 0.4,
      sheenColor: new THREE.Color("#5A3A28"),
    })
    const body = new THREE.Mesh(new RoundedBoxGeometry(S, H, S, 6, 0.14), horn)
    body.position.y = H / 2
    this.hankoBody.add(body)

    // A thin kin band near the top, and the vermilion dot that tells the hand which way is up (アタリ).
    const band = new THREE.Mesh(
      new RoundedBoxGeometry(S + 0.04, 0.09, S + 0.04, 4, 0.04),
      new THREE.MeshStandardMaterial({ color: "#C9A24A", metalness: 1, roughness: 0.28 }),
    )
    band.position.y = H * 0.78
    this.hankoBody.add(band)
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.07, 32),
      new THREE.MeshStandardMaterial({ color: SHU, roughness: 0.5 }),
    )
    dot.position.set(0, H * 0.9, S / 2 + 0.003)
    this.hankoBody.add(dot)

    // The face: an inked plate and the carved 手形 standing out of it, mirrored as a real seal is.
    const plate = new THREE.Mesh(
      new RoundedBoxGeometry(S * 0.985, 0.03, S * 0.985, 4, 0.012),
      new THREE.MeshStandardMaterial({ color: "#2A1610", roughness: 0.7 }),
    )
    plate.position.y = -0.005
    this.hankoBody.add(plate)

    const geo = new THREE.ExtrudeGeometry(reliefShapes(), {
      depth: 9,
      bevelEnabled: true,
      bevelThickness: 1.2,
      bevelSize: 0.6,
      bevelSegments: 2,
      curveSegments: 6,
    })
    // Box units → seal units; centre the 200-unit box on the face.
    geo.translate(-VIEW / 2, -VIEW / 2, 0)
    const k = (S * 0.96) / VIEW
    geo.scale(k, k, k)
    const relief = new THREE.Mesh(
      geo,
      new THREE.MeshStandardMaterial({
        color: "#FF4F00",
        roughness: 0.55,
        metalness: 0,
        emissive: "#5A1400",
        emissiveIntensity: 0.25,
      }),
    )
    // The extrusion stands along +z with y down; lay it on the underside so that, seen from below, it reads
    // mirrored, and its print on the bill reads true.
    relief.rotation.x = Math.PI / 2
    relief.position.y = -0.01
    this.hankoBody.add(relief)

    this.hankoBody.traverse((o) => {
      o.userData.hanko = true
    })
    this.hanko.add(this.hankoBody)
    this.root.add(this.hanko)

    // Idle: tipped up so the carved face shows (mirrored and upright, as a real seal reads in the hand);
    // pressing: upright, aligned with the bill. The half turn about its own axis plays as the hand brings it down.
    this.idleQuat
      .setFromEuler(new THREE.Euler(-2.0, 0.42, 0.1, "YXZ"))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI))
    this.downQuat.setFromEuler(
      new THREE.Euler(0, this.bill.rotation.y - THREE.MathUtils.degToRad(6), 0, "YXZ"),
    )
    this.hanko.position.copy(this.idlePos)
    this.hanko.quaternion.copy(this.idleQuat)
  }

  /** The business's round seal: a lathe-turned horn body with a kin band, its face cut with the seal. */
  private buildRoundHanko() {
    const R = (SEAL_SIZE / 2) * 0.98
    const H = this.bodyHeight
    const horn = new THREE.MeshPhysicalMaterial({
      color: "#15110E",
      roughness: 0.3,
      metalness: 0.05,
      clearcoat: 1,
      clearcoatRoughness: 0.12,
      sheen: 0.4,
      sheenColor: new THREE.Color("#5A3A28"),
    })
    const profile = [
      new THREE.Vector2(0, 0),
      new THREE.Vector2(R - 0.03, 0),
      new THREE.Vector2(R, 0.03),
      new THREE.Vector2(R * 0.96, H * 0.62),
      new THREE.Vector2(R * 0.9, H * 0.86),
      new THREE.Vector2(R * 0.7, H * 0.98),
      new THREE.Vector2(R * 0.35, H),
      new THREE.Vector2(0, H),
    ]
    const body = new THREE.Mesh(new THREE.LatheGeometry(profile, 72), horn)
    this.hankoBody.add(body)
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(R * 0.965, R * 0.97, 0.09, 72),
      new THREE.MeshStandardMaterial({ color: "#C9A24A", metalness: 1, roughness: 0.28 }),
    )
    band.position.y = H * 0.6
    this.hankoBody.add(band)
    const dot = new THREE.Mesh(
      new THREE.CircleGeometry(0.06, 32),
      new THREE.MeshStandardMaterial({ color: SHU, roughness: 0.5 }),
    )
    dot.position.set(0, H * 0.75, R * 0.94 + 0.004)
    this.hankoBody.add(dot)

    this.faceCanvas.width = this.faceCanvas.height = 512
    this.faceTexture = new THREE.CanvasTexture(this.faceCanvas)
    this.faceTexture.colorSpace = THREE.SRGBColorSpace
    this.faceTexture.anisotropy = 4
    const face = new THREE.Mesh(
      new THREE.CircleGeometry(R * 0.985, 72),
      new THREE.MeshStandardMaterial({
        map: this.faceTexture,
        roughness: 0.6,
        emissive: "#5A1400",
        emissiveIntensity: 0.18,
      }),
    )
    face.rotation.x = Math.PI / 2
    face.position.y = -0.002
    this.hankoBody.add(face)

    this.hankoBody.traverse((o) => {
      o.userData.hanko = true
    })
    this.hanko.add(this.hankoBody)
    this.root.add(this.hanko)
    this.idleQuat
      .setFromEuler(new THREE.Euler(-2.0, 0.42, 0.1, "YXZ"))
      .multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI))
    this.downQuat.setFromEuler(new THREE.Euler(0, this.bill.rotation.y, 0, "YXZ"))
    this.hanko.position.copy(this.idlePos)
    this.hanko.quaternion.copy(this.idleQuat)
  }

  private async buildCoins() {
    const rim = new THREE.MeshStandardMaterial({ color: "#E8E2D6", metalness: 1, roughness: 0.25 })
    const disc = new THREE.CircleGeometry(0.27, 48)
    const edge = new THREE.CylinderGeometry(0.275, 0.275, 0.06, 48, 1, true)
    edge.rotateX(Math.PI / 2)
    const textures = await Promise.all(this.options.coins.map((c) => coinTexture(c)))
    textures.forEach((map, i) => {
      const group = new THREE.Group()
      const mat = new THREE.MeshStandardMaterial({ map, roughness: 0.38, metalness: 0.05 })
      const front = new THREE.Mesh(disc, mat)
      front.position.z = 0.031
      const back = new THREE.Mesh(disc, mat)
      back.rotation.y = Math.PI
      back.position.z = -0.031
      group.add(front, back, new THREE.Mesh(edge, rim))
      this.root.add(group)
      this.coins.push({
        group,
        phase: (i / textures.length) * Math.PI * 2,
        flip: Math.random() * 10,
      })
    })
  }

  private resize() {
    const { clientWidth: w, clientHeight: h } = this.container
    if (!w || !h) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    // Narrow boxes (phones) pull the camera back so the bill and the orbit still fit.
    // Onboarding's stage is narrower and has paper cards floating at its foot: pull back and lift the desk.
    const welcome = this.options.mode === "welcome"
    const pull =
      THREE.MathUtils.clamp(1.05 / this.camera.aspect, 0.92, 1.8) * 1.24 * (welcome ? 1.1 : 1)
    this.camera.position.set(-0.3, 8.4 * pull, 7.6 * pull)
    this.camera.lookAt(-0.3, welcome ? 0.5 : 0.8, welcome ? 0.85 : 0.1)
    this.camera.updateProjectionMatrix()
    if (!this.running) this.render(this.now())
  }

  private now() {
    return (performance.now() - this.t0) / 1000
  }

  setTheme(dark: boolean) {
    this.dark = !!this.options.night || dark
    this.applyTheme()
  }

  private applyTheme() {
    this.rimLight.intensity = this.dark ? 26 : 9
    this.scene.environmentIntensity = this.dark ? 0.4 : 0.55
  }

  private onPointerMove = (e: PointerEvent) => {
    const r = this.container.getBoundingClientRect()
    this.pointer.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    )
    const clickable = this.options.mode !== "welcome" || this.paid
    this.container.style.cursor = clickable && this.hitHanko() ? "pointer" : ""
  }

  private onPointerLeave = () => {
    this.pointer.set(0, 0)
    this.container.style.cursor = ""
  }

  private onClick = () => {
    if (this.options.mode === "welcome" && !this.paid) return
    if (this.hitHanko()) this.pressSeal(true)
  }

  private hitHanko() {
    this.raycaster.setFromCamera(this.pointer, this.camera)
    return this.raycaster.intersectObject(this.hanko, true).length > 0
  }

  /** Starts a press. The first runs on its own; any click on the seal presses again. */
  pressSeal(byUser: boolean) {
    if (this.press || this.disposed) return
    this.press = { start: null, byUser, touched: false }
    this.start()
  }

  private setPaid(paid: boolean) {
    this.paid = paid
    if (this.welcome) this.welcome.open = paid
    this.drawCurrentBill(paid)
  }

  private start() {
    if (this.running || this.disposed || !this.visible) return
    this.running = true
    const loop = () => {
      if (!this.running) return
      this.render(this.now())
      this.frame = requestAnimationFrame(loop)
    }
    this.frame = requestAnimationFrame(loop)
  }

  private stop() {
    this.running = false
    cancelAnimationFrame(this.frame)
  }

  private render(t: number) {
    if (!this.visible) {
      this.stop()
      return
    }
    // The resize observer can fire before init() has built the objects.
    if (!this.contact || !this.images) {
      this.renderer.render(this.scene, this.camera)
      return
    }
    if (this.press && this.press.start === null) this.press.start = t
    // Pointer parallax: the desk leans a few degrees toward the pointer.
    this.parallax.lerp(this.pointer, 0.06)
    this.root.rotation.y = this.parallax.x * 0.07
    this.root.rotation.x = -this.parallax.y * 0.04

    const P = 1.6 // seconds for one press
    const p = this.press ? (t - (this.press.start ?? t)) / P : -1
    const hover = Math.sin(t * 1.2) * 0.07

    // Idle pose, breathing.
    const idlePos = this.idlePos.clone().add(new THREE.Vector3(0, hover, 0))
    const idleQuat = this.idleQuat
      .clone()
      .multiply(
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(Math.sin(t * 0.5) * 0.06, Math.sin(t * 0.37) * 0.22, 0),
        ),
      )

    const above = new THREE.Vector3(this.stampWorld.x, 1.25, this.stampWorld.z)
    const down = new THREE.Vector3(this.stampWorld.x, 0.035, this.stampWorld.z)
    let squash = 1
    let coinPull = 0 // 0 = in orbit, 1 = poured into the bill

    if (p >= 0 && p <= 1) {
      // A: turn face-down and travel over the spot. B: drop. C: press. D: lift home.
      const a = easeInOut(span(p, 0, 0.36))
      const b = easeIn(span(p, 0.36, 0.47))
      const c = span(p, 0.47, 0.6)
      const d = easeOut(span(p, 0.6, 1))
      const pos = idlePos.clone().lerp(above, a)
      pos.lerp(down, b)
      const q = idleQuat.clone().slerp(this.downQuat, a)
      if (d > 0) {
        pos.copy(down).lerp(idlePos, d)
        q.copy(this.downQuat).slerp(idleQuat, d)
      }
      squash = c > 0 && c < 1 ? 1 - Math.sin(c * Math.PI) * 0.045 : 1
      this.hanko.position.copy(pos)
      this.hanko.quaternion.copy(q)
      coinPull = p < 0.47 ? easeInOut(span(p, 0.02, 0.4)) : 1 - easeOut(span(p, 0.75, 1))
      if (c > 0 && !this.press!.touched) this.land(1.06)
      if (this.ink.scale.x > 1) this.ink.scale.setScalar(Math.max(1, this.ink.scale.x - 0.006))
    } else {
      if (p > 1) {
        // The tab was hidden mid-press, so no frame fell in the contact window: the press still counts.
        if (!this.press!.touched) this.land(1)
        this.press = null
      }
      this.hanko.position.copy(idlePos)
      this.hanko.quaternion.copy(idleQuat)
    }
    this.hankoBody.scale.set(1 + (1 - squash) * 0.6, squash, 1 + (1 - squash) * 0.6)

    // The contact shadow darkens and tightens as the seal nears the paper.
    const height = Math.max(0, this.hanko.position.y)
    const local = this.bill.worldToLocal(
      new THREE.Vector3(this.hanko.position.x, 0, this.hanko.position.z),
    )
    this.contact.position.x = local.x
    this.contact.position.z = local.z
    const s = SEAL_SIZE * (1.25 + height * 0.55)
    this.contact.scale.set(s, s, 1)
    this.contact.material.opacity = THREE.MathUtils.clamp(0.66 - height * 0.26, 0.04, 0.66)

    // Coins: an orbit around the seal; during a press they pour into the bill's amount.
    const amount = this.bill.localToWorld(
      new THREE.Vector3((560 / BILL_PX_W - 0.5) * BILL_W, 0.05, (440 / BILL_PX_H - 0.5) * BILL_H),
    )
    const centre = this.idlePos.clone().add(new THREE.Vector3(-0.85, 0.05, 0.1))
    this.coins.forEach((coin, i) => {
      const ang = coin.phase + t * 0.22
      const orbit = new THREE.Vector3(
        centre.x + Math.cos(ang) * 2.05,
        centre.y + Math.sin(ang) * 0.55 + Math.sin(t * 0.9 + i) * 0.06,
        centre.z + Math.sin(ang) * 1.45,
      )
      const stagger = clamp01(coinPull * 1.35 - (i / this.coins.length) * 0.35)
      const k = easeInOut(stagger)
      const pos = orbit.clone().lerp(amount, k)
      pos.y += Math.sin(k * Math.PI) * 0.6
      coin.group.position.copy(pos)
      coin.group.lookAt(this.camera.position)
      // Now and then a coin flips, catching the light on its rim.
      const cycle = (t + coin.flip) % 9
      const flip = cycle < 0.9 ? easeInOut(cycle / 0.9) * Math.PI * 2 : 0
      coin.group.rotateY(flip + Math.sin(t * 0.8 + i) * 0.25)
      const scale = (1 - k * 0.85) * (0.82 + (Math.sin(ang) + 1) * 0.14)
      coin.group.scale.setScalar(Math.max(0.001, scale))
      coin.group.visible = scale > 0.02
    })

    this.renderer.render(this.scene, this.camera)
  }

  /** The seal meets the paper: the bill turns Paid (or Open), the ink lands, and the caller hears it once. */
  private land(inkScale: number) {
    if (!this.press) return
    this.press.touched = true
    this.setPaid(true)
    this.ink.material.opacity = 0.95
    this.ink.scale.setScalar(inkScale)
    this.options.onContact?.(this.press.byUser)
  }

  dispose() {
    this.disposed = true
    this.stop()
    this.ro.disconnect()
    this.io.disconnect()
    this.container.removeEventListener("pointermove", this.onPointerMove)
    this.container.removeEventListener("pointerleave", this.onPointerLeave)
    this.container.removeEventListener("click", this.onClick)
    this.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      mesh.geometry?.dispose()
      const mats = Array.isArray(mesh.material)
        ? mesh.material
        : mesh.material
          ? [mesh.material]
          : []
      for (const m of mats) {
        for (const v of Object.values(m)) if (v instanceof THREE.Texture) v.dispose()
        m.dispose()
      }
    })
    this.scene.environment?.dispose()
    this.envTarget?.dispose()
    this.renderer.dispose()
    // dispose() alone leaves the context alive until garbage collection; browsers cap live contexts, so release it.
    this.renderer.forceContextLoss()
    this.renderer.domElement.remove()
  }

  get isPaid() {
    return this.paid
  }
}

export { GLYPH_BOX }
