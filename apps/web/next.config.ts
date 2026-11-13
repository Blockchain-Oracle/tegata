import type { NextConfig } from "next"

// One `.env` at the repo root serves the web app, the worker and the scripts.
try {
  process.loadEnvFile(new URL("../../.env", import.meta.url).pathname)
} catch {
  // Docker and CI pass variables directly.
}

const config: NextConfig = {
  output: "standalone",
  // A separate folder lets a production build run beside the dev server without clobbering it.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  // The monorepo root, so the standalone build traces workspace packages.
  outputFileTracingRoot: new URL("../../", import.meta.url).pathname,
  // Workspace packages ship TypeScript source.
  transpilePackages: [
    "@tegata/config",
    "@tegata/core",
    "@tegata/db",
    "@tegata/documents",
    "@tegata/env",
    "@tegata/jobs",
    "@tegata/services",
  ],
  // Node-only packages stay external to the server bundle.
  serverExternalPackages: ["postgres", "pg-boss", "@react-pdf/renderer"],
  poweredByHeader: false,
  // Keep the dev server from accumulating multi-gigabyte Turbopack cache files.
  experimental: { turbopackFileSystemCacheForDev: false },
  // No other site may frame Tegata's pages (clickjacking: a signed-in owner tricked into pressing Send or Approve).
  // Only Tegata frames itself (the /dev phone frame, the invoice preview). The one exception is /checkout/<token>,
  // the pay page made to open over a merchant's own site (checkout.js); it holds no owner actions.
  async headers() {
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    ]
    return [
      {
        source: "/:path((?!checkout/).*)",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          ...common,
        ],
      },
      {
        source: "/checkout/:token",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }, ...common],
      },
      {
        // The embed script: cached a day, refetched when its version query changes.
        source: "/checkout.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=86400" },
          { key: "Access-Control-Allow-Origin", value: "*" },
        ],
      },
    ]
  },
}

export default config
