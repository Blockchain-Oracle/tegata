import { LINKS } from "@/lib/links"

/** tegata.xyz/video: the short address for the demo video, which lives on YouTube. */
export function GET() {
  return Response.redirect(LINKS.demoVideo, 307)
}
