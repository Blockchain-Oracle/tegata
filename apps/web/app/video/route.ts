/** tegata.xyz/video: the short address for the demo, which plays on /demo. */
export function GET() {
  return new Response(null, { status: 307, headers: { Location: "/demo" } })
}
