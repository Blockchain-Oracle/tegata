// Tegata signs in with an email code only. expo-apple-authentication is installed because Privy's SDK imports it, and
// its plugin adds the Sign in with Apple entitlement; Apple's capability API then refuses the App ID update. This
// removes the entitlement so the provisioning profile only carries what the app uses.
const { withEntitlementsPlist } = require("expo/config-plugins")

module.exports = function withoutAppleSignIn(config) {
  return withEntitlementsPlist(config, (mod) => {
    delete mod.modResults["com.apple.developer.applesignin"]
    return mod
  })
}
