// The code to tegata.xyz/download with the Tegata seal pressed in its centre, on paper. Error correction H rebuilds up
// to 30% of the code, far more than the seal covers, so any phone camera still reads it.
import { QRCodeSVG } from "qrcode.react"

import { TegataSeal } from "@/components/brand/seal"

export const DOWNLOAD_URL = "https://tegata.xyz/download"

export function DownloadQr({ size = 84 }: { size?: number }) {
  return (
    <span className="relative block" style={{ width: size, height: size }}>
      <QRCodeSVG value={DOWNLOAD_URL} size={size} level="H" bgColor="#FFFCF6" fgColor="#16130F" />
      <span className="absolute inset-0 grid place-items-center">
        <span className="rounded-[6px] bg-paper p-[2px]">
          <TegataSeal size={Math.round(size * 0.22)} textured={false} />
        </span>
      </span>
    </span>
  )
}
