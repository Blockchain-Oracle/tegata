// What /download offers right now (S11). The iPhone app goes out through Apple's TestFlight; the Android app is the APK
// from the EAS `preview` build, linked where EAS serves it, with its SHA-256 so anyone can check the file they got.
// Update these after each mobile release (apps/mobile; `eas build --profile preview|production`).

export interface AndroidRelease {
  version: string
  /** Android versionCode (EAS remote version). */
  build: number
  url: string
  sha256: string
  sizeBytes: number
  builtAt: string
}

export interface IosRelease {
  version: string
  /** The build Apple has (App Store Connect build number). */
  build: number
  /** Apple's public TestFlight invitation (App Store Connect → TestFlight → public link), once the beta takes testers. */
  testflight: string | null
}

export const IOS: IosRelease = {
  version: "1.0.0",
  build: 4,
  testflight: null,
}

export const ANDROID: AndroidRelease | null = null

/** Only Apple's own join links count as a TestFlight invitation. */
export function isTestflightLink(url: string | null): url is string {
  if (!url) return false
  try {
    const parsed = new URL(url)
    return (
      parsed.hostname === "testflight.apple.com" &&
      /^\/join\/[A-Za-z0-9]+\/?$/.test(parsed.pathname)
    )
  } catch {
    return false
  }
}

/**
 * Whether Apple's join page takes testers now (it says "isn't accepting any new testers" until its beta review passes).
 * Read at most every five minutes; an unreadable page is never treated as open.
 */
export async function testflightOpen(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      headers: { "accept-language": "en-US" },
      next: { revalidate: 300 },
    })
    if (!response.ok) return false
    const html = await response.text()
    return !/isn(?:'|’|&#39;|&#x27;|&apos;)t accepting any new testers|this beta is full/i.test(
      html,
    )
  } catch {
    return false
  }
}
