// Sandbox or Live for this request (plan 6.8 AB). The mode capsule sets the `tegata-mode` cookie; Live is honoured only
// when the server has it switched on, so until then every request is the Sandbox (NEAR testnet).
import type { NetworkId } from "@tegata/config"
import { liveEnabled } from "@tegata/env"

export const MODE_COOKIE = "tegata-mode"

export function requestNetwork(request: Request): NetworkId {
  const live = /(?:^|;\s*)tegata-mode=live(?:;|$)/.test(request.headers.get("cookie") ?? "")
  return live && liveEnabled() ? "mainnet" : "testnet"
}
