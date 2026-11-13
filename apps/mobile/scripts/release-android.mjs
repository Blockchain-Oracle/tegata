// Release an Android APK built by EAS (`eas build -p android --profile preview`) in one step:
//   node apps/mobile/scripts/release-android.mjs <EAS .apk URL> <version> <versionCode>
// It downloads the APK, measures its SHA-256 and size, writes them into apps/web/app/download/release.ts (what
// tegata.xyz/download shows), and puts the APK with a SHA256SUMS.txt on the repo's GitHub release `mobile-v<version>`
// as a draft (publish it on GitHub when ready; /download shows the GitHub copy only once GitHub serves it publicly).
// Needs `gh` signed in to GitHub. Never pushes code.
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const [url, version, code] = process.argv.slice(2)
if (!url?.startsWith("https://") || !/^\d+\.\d+\.\d+$/.test(version ?? "") || !/^\d+$/.test(code ?? "")) {
  console.error("usage: release-android.mjs <EAS .apk URL> <version, e.g. 1.0.1> <versionCode, e.g. 2>")
  process.exit(1)
}

const repo = "Blockchain-Oracle/tegata"
const tag = `mobile-v${version}`
const name = `tegata-${version}.apk`
const dir = mkdtempSync(join(tmpdir(), "tegata-apk-"))
const apk = join(dir, name)

const response = await fetch(url)
if (!response.ok) throw new Error(`Couldn't download the APK: ${response.status}`)
writeFileSync(apk, Buffer.from(await response.arrayBuffer()))
const sha256 = createHash("sha256").update(readFileSync(apk)).digest("hex")
const size = statSync(apk).size
writeFileSync(join(dir, "SHA256SUMS.txt"), `${sha256}  ${name}\n`)

// The download page's facts.
const here = dirname(fileURLToPath(import.meta.url))
const releaseFile = join(here, "../../web/app/download/release.ts")
const source = readFileSync(releaseFile, "utf8")
const block = `export const ANDROID: AndroidRelease | null = {
  version: "${version}",
  build: ${code},
  url: "${url}",
  sha256: "${sha256}",
  sizeBytes: ${size.toLocaleString("en-US").replaceAll(",", "_")},
  builtAt: "${new Date().toISOString().replace(/\.\d+Z$/, "Z")}",
  github: "https://github.com/${repo}/releases/download/${tag}/${name}",
}`
const next = source.replace(/export const ANDROID: AndroidRelease \| null = (?:null|\{[\s\S]*?\n\})/, block)
if (next === source) throw new Error("Couldn't find the ANDROID block in release.ts")
writeFileSync(releaseFile, next)

// The GitHub release: create it as a draft, or replace the files on the existing one.
const exists = (() => {
  try {
    execFileSync("gh", ["release", "view", tag, "--repo", repo], { stdio: "ignore" })
    return true
  } catch {
    return false
  }
})()
const files = [apk, join(dir, "SHA256SUMS.txt")]
if (exists) execFileSync("gh", ["release", "upload", tag, ...files, "--repo", repo, "--clobber"], { stdio: "inherit" })
else
  execFileSync(
    "gh",
    [
      "release", "create", tag, ...files,
      "--repo", repo, "--draft", "--target", "main",
      "--title", `Tegata mobile ${version}`,
      "--notes", `Android APK ${version} (versionCode ${code}), ${(size / 1e6).toFixed(1)} MB.\n\nSHA-256: \`${sha256}\`\n\niPhone: TestFlight, linked from https://tegata.xyz/download.`,
    ],
    { stdio: "inherit" },
  )

console.log(`APK ${version} (${code}): ${(size / 1e6).toFixed(1)} MB, sha256 ${sha256}`)
console.log(`Updated ${releaseFile} and the GitHub release ${tag} (draft until you publish it).`)
