// What /download offers right now (S11). The iPhone app goes out through Apple's TestFlight; the Android app is the APK
// from the EAS `preview` build, linked where EAS serves it (fast, global), with its SHA-256 so anyone can check the
// file, and mirrored on the repo's GitHub release. `node apps/mobile/scripts/release-android.mjs` updates ANDROID and
// the GitHub release after each preview build.

export interface AndroidRelease {
  version: string
  /** Android versionCode (EAS remote version). */
  build: number
  url: string
  sha256: string
  sizeBytes: number
  builtAt: string
  /** The same file on the repo's GitHub release; shown only once GitHub serves it publicly. */
  github: string
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
  build: 5,
  testflight: null,
}

export const ANDROID: AndroidRelease | null = {
  version: "1.0.0",
  build: 1,
  url: "https://expo.dev/artifacts/eas/J-kIepU5qgdJIYQWCvfzcLCre1O8GNan037QXJZaiow.apk",
  sha256: "9ac8add6aa8a2c64c3d980abf5a2aee9337e61925a56c54af2118d455d783640",
  sizeBytes: 82_498_985,
  builtAt: "2026-11-13T17:45:00Z",
  github:
    "https://github.com/Blockchain-Oracle/tegata/releases/download/mobile-v1.0.0/tegata-1.0.0.apk",
}

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

/**
 * Whether a GitHub release file is public (the repo public and the release published): GitHub answers a public asset
 * with a redirect to its storage and a private or draft one with 404. Read at most every ten minutes; any doubt hides it.
 */
export async function githubPublic(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "manual",
      next: { revalidate: 600 },
    })
    return response.status === 302 || response.status === 200
  } catch {
    return false
  }
}
