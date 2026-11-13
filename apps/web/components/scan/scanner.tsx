"use client"

// Scan a QR code (Abu, 2026-11-13: "the QR code is all the stuff, but we cannot even scan"). The camera reads frames
// with the browser's own BarcodeDetector where it exists (Chrome, Android) and jsQR everywhere else (iPhone Safari);
// a photo or screenshot can be chosen instead. What was read is shown with the one thing to do next: open the pay link,
// send to the NEAR account, or send to the address on its chain.
import { ArrowRight, Camera, ImageUp, ScanLine, TriangleAlert } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/kit/button"
import { Mark } from "@/components/marks/mark"
import { fire } from "@/lib/feedback"
import { PAYER_ROUTES } from "@/lib/routes"
import { readScanned, type Scanned, scannedHref } from "@/lib/scan"

const FRAME_MS = 160

type CameraState = "starting" | "on" | "blocked" | "none" | "off"

interface Detector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>
}

/** The browser's own QR reader, when it has one. */
function nativeDetector(): Detector | null {
  const Ctor = (globalThis as { BarcodeDetector?: new (o: { formats: string[] }) => Detector })
    .BarcodeDetector
  try {
    return Ctor ? new Ctor({ formats: ["qr_code"] }) : null
  } catch {
    return null
  }
}

/** Read a QR code from an image or a video frame: the native reader first, jsQR as the fallback. */
export async function decodeQr(
  source: CanvasImageSource,
  width: number,
  height: number,
  options: { native?: boolean } = {},
): Promise<string | null> {
  const native = options.native === false ? null : nativeDetector()
  if (native) {
    try {
      const found = await native.detect(source)
      if (found[0]?.rawValue) return found[0].rawValue
    } catch {
      // Fall through to jsQR.
    }
  }
  const canvas = document.createElement("canvas")
  // Big photos are scaled down: jsQR is quick on ~1000 px and QR codes survive it.
  const scale = Math.min(1, 1000 / Math.max(width, height))
  canvas.width = Math.max(1, Math.round(width * scale))
  canvas.height = Math.max(1, Math.round(height * scale))
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
  const { default: jsQR } = await import("jsqr")
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  return (
    jsQR(image.data, image.width, image.height, { inversionAttempts: "attemptBoth" })?.data ?? null
  )
}

export function Scanner({ onGo, active }: { onGo: (href: string) => void; active: boolean }) {
  const video = useRef<HTMLVideoElement>(null)
  const stream = useRef<MediaStream | null>(null)
  const photo = useRef<HTMLInputElement>(null)
  const [camera, setCamera] = useState<CameraState>("off")
  const [result, setResult] = useState<Scanned | null>(null)
  const [problem, setProblem] = useState<string | null>(null)

  const stop = useCallback(() => {
    for (const track of stream.current?.getTracks() ?? []) track.stop()
    stream.current = null
  }, [])

  const found = useCallback(
    (text: string) => {
      fire("tick", { cue: "confirmed" })
      setProblem(null)
      setResult(readScanned(text))
      stop()
      setCamera("off")
    },
    [stop],
  )

  const start = useCallback(async () => {
    setResult(null)
    setProblem(null)
    if (!navigator.mediaDevices?.getUserMedia) {
      setCamera("none")
      return
    }
    setCamera("starting")
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      })
      stream.current = media
      if (video.current) {
        video.current.srcObject = media
        await video.current.play().catch(() => undefined)
      }
      setCamera("on")
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ""
      setCamera(name === "NotAllowedError" || name === "SecurityError" ? "blocked" : "none")
    }
  }, [])

  // The camera runs only while the sheet is open.
  useEffect(() => {
    if (active) void start()
    else {
      stop()
      setCamera("off")
      setResult(null)
    }
    return stop
  }, [active, start, stop])

  // Read frames while the camera is on.
  useEffect(() => {
    if (camera !== "on") return
    let busy = false
    const timer = setInterval(async () => {
      const v = video.current
      if (busy || !v || v.readyState < 2 || !v.videoWidth) return
      busy = true
      try {
        const text = await decodeQr(v, v.videoWidth, v.videoHeight)
        if (text) found(text)
      } finally {
        busy = false
      }
    }, FRAME_MS)
    return () => clearInterval(timer)
  }, [camera, found])

  async function fromPhoto(file: File | undefined) {
    if (!file) return
    setProblem(null)
    try {
      const bitmap = await createImageBitmap(file)
      const text = await decodeQr(bitmap, bitmap.width, bitmap.height)
      bitmap.close()
      if (text) found(text)
      else {
        fire("fail", { cue: "error" })
        setProblem("No QR code in that picture. Try one where the code fills more of it.")
      }
    } catch {
      fire("fail", { cue: "error" })
      setProblem("That file couldn't be opened as a picture.")
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {result ? (
        <ScanResult
          scanned={result}
          onGo={onGo}
          onAgain={() => {
            void start()
          }}
        />
      ) : (
        <>
          <div className="relative aspect-square w-full overflow-hidden rounded-[24px] bg-black">
            <video
              ref={video}
              playsInline
              muted
              className={camera === "on" ? "size-full object-cover" : "hidden"}
            />
            {camera === "on" ? (
              <div className="pointer-events-none absolute inset-[14%]">
                {[
                  "top-0 left-0 border-t-4 border-l-4 rounded-tl-[18px]",
                  "top-0 right-0 border-t-4 border-r-4 rounded-tr-[18px]",
                  "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-[18px]",
                  "bottom-0 right-0 border-b-4 border-r-4 rounded-br-[18px]",
                ].map((corner) => (
                  <span key={corner} className={`absolute size-10 border-shu ${corner}`} />
                ))}
                <span className="absolute inset-x-2 top-1/2 h-0.5 animate-pulse rounded-full bg-shu/80" />
              </div>
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center text-white">
                {camera === "starting" ? (
                  <>
                    <Camera className="size-8 animate-pulse" />
                    <span className="text-[15px] font-medium">Opening the camera…</span>
                  </>
                ) : camera === "blocked" ? (
                  <>
                    <TriangleAlert className="size-8 text-shu" />
                    <span className="text-[15px] font-medium">
                      The camera is blocked for this site. Allow it in your browser's settings, or
                      choose a photo of the code.
                    </span>
                  </>
                ) : camera === "none" ? (
                  <>
                    <ImageUp className="size-8" />
                    <span className="text-[15px] font-medium">
                      No camera here. Choose a photo or screenshot of the code.
                    </span>
                  </>
                ) : (
                  <>
                    <ScanLine className="size-8" />
                    <span className="text-[15px] font-medium">Ready to scan</span>
                  </>
                )}
              </div>
            )}
          </div>
          <p className="text-center text-detail text-muted-foreground">
            A Tegata pay link or invoice, a NEAR account, or a wallet's address on another chain.
          </p>
          {problem ? (
            <p className="text-center text-[15px] font-medium text-down">{problem}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => photo.current?.click()}>
              <ImageUp /> Choose a photo
            </Button>
            <Button
              variant="secondary"
              onClick={() => void start()}
              disabled={camera === "on" || camera === "starting"}
            >
              <Camera /> {camera === "blocked" || camera === "none" ? "Try the camera" : "Camera"}
            </Button>
          </div>
          <input
            ref={photo}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              void fromPhoto(e.target.files?.[0])
              e.target.value = ""
            }}
          />
        </>
      )}
    </div>
  )
}

function ScanResult({
  scanned,
  onGo,
  onAgain,
}: {
  scanned: Scanned
  onGo: (href: string) => void
  onAgain: () => void
}) {
  const href = scannedHref(scanned)
  const route = scanned.kind === "chain" ? PAYER_ROUTES.find((r) => r.id === scanned.routeId) : null
  const title =
    scanned.kind === "tegata"
      ? scanned.what
      : scanned.kind === "near"
        ? "A NEAR account"
        : scanned.kind === "chain"
          ? `An address on ${scanned.chain}`
          : scanned.kind === "url"
            ? "A web link"
            : "Some text"
  const value =
    scanned.kind === "tegata"
      ? scanned.href
      : scanned.kind === "near"
        ? scanned.accountId
        : scanned.kind === "chain"
          ? scanned.address
          : scanned.kind === "url"
            ? scanned.url
            : scanned.text
  const action =
    scanned.kind === "tegata"
      ? "Open it"
      : scanned.kind === "near"
        ? `Send to ${scanned.accountId}`
        : scanned.kind === "chain"
          ? `Send ${scanned.symbol} on ${scanned.chain}`
          : null
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-[20px] bg-secondary p-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-full bg-card">
          {scanned.kind === "near" ? (
            <Mark id="near" size={28} />
          ) : route ? (
            <Mark id={route.coin} chain={route.chainMark} size={28} />
          ) : (
            <ScanLine className="size-6" />
          )}
        </span>
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-semibold">{title}</span>
          <span className="break-all font-mono text-[13px] text-muted-foreground">{value}</span>
        </span>
      </div>
      {scanned.kind === "chain" ? (
        <p className="text-detail text-muted-foreground">
          Paying another chain runs in Live: NEAR Intents converts your dollars on the way.
        </p>
      ) : null}
      {href && action ? (
        <Button onClick={() => onGo(href)} cue="tap">
          {action} <ArrowRight />
        </Button>
      ) : scanned.kind === "url" ? (
        <Button asChild>
          <a href={scanned.url} target="_blank" rel="noreferrer">
            Open the link <ArrowRight />
          </a>
        </Button>
      ) : (
        <p className="text-[15px] text-muted-foreground">
          That code isn't something Tegata can pay. Try a pay link, a NEAR account or a wallet
          address.
        </p>
      )}
      <Button variant="secondary" onClick={onAgain}>
        Scan another
      </Button>
    </div>
  )
}
