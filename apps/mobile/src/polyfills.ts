// Globals the native runtime lacks, installed by the entry (`index.ts`) before any other module runs: secure random
// bytes for Privy and the hash check, TextEncoder, and ethers' shims (Privy's setup docs).
import "react-native-get-random-values"
import "fast-text-encoding"
import "@ethersproject/shims"
