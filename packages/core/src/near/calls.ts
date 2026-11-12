import { type Action, actions } from "near-api-js"

/**
 * One contract call, in a form that travels as JSON and always encodes to the same bytes.
 * `argsJson` is the exact string sent on chain: the server writes it once and the browser
 * uses it as-is, so both sides hash the same delegate action.
 */
export interface CallSpec {
  method: string
  argsJson: string
  /** Gas units, as a decimal string. */
  gas: string
  /** yoctoNEAR, as a decimal string. */
  deposit: string
}

export function call(
  method: string,
  args: Record<string, unknown>,
  gas: bigint,
  deposit: bigint = 0n,
): CallSpec {
  return {
    method,
    argsJson: JSON.stringify(args),
    gas: gas.toString(),
    deposit: deposit.toString(),
  }
}

export function toAction(spec: CallSpec): Action {
  return actions.functionCall(
    spec.method,
    new TextEncoder().encode(spec.argsJson),
    BigInt(spec.gas),
    BigInt(spec.deposit),
  )
}

export function totalGas(specs: readonly CallSpec[]): bigint {
  return specs.reduce((sum, spec) => sum + BigInt(spec.gas), 0n)
}

export function totalDeposit(specs: readonly CallSpec[]): bigint {
  return specs.reduce((sum, spec) => sum + BigInt(spec.deposit), 0n)
}
