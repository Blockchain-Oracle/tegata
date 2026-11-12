import { createMDX } from "fumadocs-mdx/next"

const withMDX = createMDX()

/**
 * Tegata's docs: a static export (`out/`) served by one small nginx container, so the docs cost almost nothing
 * to run and a docs problem can never take the product down.
 */
/** @type {import('next').NextConfig} */
const config = {
  output: "export",
  reactStrictMode: true,
  images: { unoptimized: true },
}

export default withMDX(config)
