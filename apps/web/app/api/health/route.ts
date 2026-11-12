/** Liveness for the container probe: the server answers. Database and NEAR health are reported by their own routes. */
export function GET() {
  return Response.json({ ok: true })
}
