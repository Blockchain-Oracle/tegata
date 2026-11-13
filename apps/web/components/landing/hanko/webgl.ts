// Whether this browser can draw the 3D seal. Asked once per page: every probe opens a WebGL context, and browsers
// cap how many can be alive at once, so the probe's context is released at once and the answer is remembered.
let answer: boolean | undefined

export function webglAvailable() {
  if (answer !== undefined) return answer
  try {
    const c = document.createElement("canvas")
    const gl = c.getContext("webgl2") || c.getContext("webgl")
    gl?.getExtension("WEBGL_lose_context")?.loseContext()
    answer = !!gl
  } catch {
    answer = false
  }
  return answer
}
