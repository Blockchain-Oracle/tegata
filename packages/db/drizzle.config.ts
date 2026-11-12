import { defineConfig } from "drizzle-kit"

try {
  process.loadEnvFile("../../.env")
} catch {
  // CI and Docker pass DATABASE_URL directly.
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  casing: "snake_case",
  // `generate` never connects; `migrate` needs the real URL.
  dbCredentials: { url: process.env.DATABASE_URL ?? "postgres://localhost/tegata" },
  strict: true,
})
