// A QR code drawn as SVG modules (the `qrcode` package makes the matrix), rounded dots with solid finder eyes, and the
// Tegata seal in the middle on a cleared square (error correction H, so the seal never breaks a scan).
import QRCode from "qrcode"
import { useMemo } from "react"
import { View } from "react-native"
import Svg, { G, Rect } from "react-native-svg"

import { TegataSeal } from "./seal"

export function Qr({ value, size = 232, color = "#000000" }: { value: string; size?: number; color?: string }) {
  const matrix = useMemo(() => QRCode.create(value, { errorCorrectionLevel: "H" }).modules, [value])
  const n = matrix.size
  const cell = size / n
  const hole = Math.ceil(n * 0.24) | 1
  const holeStart = Math.floor((n - hole) / 2)
  const inHole = (x: number, y: number) =>
    x >= holeStart && x < holeStart + hole && y >= holeStart && y < holeStart + hole
  const inEye = (x: number, y: number) =>
    (x < 7 && y < 7) || (x >= n - 7 && y < 7) || (x < 7 && y >= n - 7)
  const dots: { x: number; y: number }[] = []
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) if (matrix.get(x, y) && !inHole(x, y) && !inEye(x, y)) dots.push({ x, y })
  const eye = (ex: number, ey: number) => (
    <G key={`${ex}-${ey}`}>
      <Rect x={ex * cell} y={ey * cell} width={7 * cell} height={7 * cell} rx={cell * 2} fill={color} />
      <Rect x={(ex + 1) * cell} y={(ey + 1) * cell} width={5 * cell} height={5 * cell} rx={cell * 1.4} fill="#FFFFFF" />
      <Rect x={(ex + 2) * cell} y={(ey + 2) * cell} width={3 * cell} height={3 * cell} rx={cell} fill={color} />
    </G>
  )
  const sealSize = hole * cell * 0.92
  return (
    <View style={{ width: size, height: size }} accessibilityLabel="QR code">
      <Svg width={size} height={size}>
        {dots.map(({ x, y }) => (
          <Rect
            key={`${x}-${y}`}
            x={x * cell + cell * 0.08}
            y={y * cell + cell * 0.08}
            width={cell * 0.84}
            height={cell * 0.84}
            rx={cell * 0.3}
            fill={color}
          />
        ))}
        {eye(0, 0)}
        {eye(n - 7, 0)}
        {eye(0, n - 7)}
      </Svg>
      <View
        style={{
          position: "absolute",
          left: (size - sealSize) / 2,
          top: (size - sealSize) / 2,
        }}
      >
        <TegataSeal size={sealSize} />
      </View>
    </View>
  )
}
