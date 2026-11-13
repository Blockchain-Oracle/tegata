// Privy's Expo SDK needs three resolver rules (its setup docs, basics/react-native/installation): `jose` resolves its
// browser build (the default "node" build imports node:crypto), and `isows` and `zustand` skip their package exports.
const { getDefaultConfig } = require("expo/metro-config")

const config = getDefaultConfig(__dirname)

function privyContext(context, moduleName) {
  if (moduleName === "jose") return { ...context, unstable_conditionNames: ["browser"] }
  if (moduleName === "isows" || moduleName.startsWith("zustand"))
    return { ...context, unstable_enablePackageExports: false }
  return context
}

const resolveRequest = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const next = privyContext(context, moduleName)
  return resolveRequest
    ? resolveRequest(next, moduleName, platform)
    : context.resolveRequest(next, moduleName, platform)
}

module.exports = config
