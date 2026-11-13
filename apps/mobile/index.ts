// The app's entry: globals first, then Expo Router. Key code (@noble/hashes, under Privy and viem) reads
// `globalThis.crypto` when its module first runs; installing the globals here, before any other module, means a
// Release build never sees "crypto.getRandomValues must be defined" (Kawase's lesson).
import "./src/polyfills"
import "expo-router/entry"
