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
  // No other site may frame Tegata's pages (clickjacking: a signed-in owner tricked into pressing Send or Approve).
  // Only Tegata frames itself (the /dev phone frame, the invoice preview).
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ]
  },
}

export default config
