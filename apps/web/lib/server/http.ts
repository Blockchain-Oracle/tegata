import {
  BusinessError,
  OnboardError,
  PaymentError,
  RelayError,
  SandboxError,
} from "@tegata/services"
import { ZodError } from "zod"

const STATUS = {
  badRequest: 400,
  unauthorized: 401,
  notFound: 404,
  conflict: 409,
  tooMany: 429,
  serverError: 500,
} as const

/** An error whose message is safe to show the person. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

export const unauthorized = () =>
  new HttpError(STATUS.unauthorized, "unauthorized", "Sign in first")
export const badRequest = (message: string, code = "bad_request") =>
  new HttpError(STATUS.badRequest, code, message)
export const notFound = (message = "Not found") =>
  new HttpError(STATUS.notFound, "not_found", message)

function toResponse(error: unknown): Response {
  if (error instanceof HttpError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: error.status },
    )
  }
  if (error instanceof ZodError) {
    const message = error.issues[0]?.message ?? "Check the details and try again"
    return Response.json({ error: { code: "invalid", message } }, { status: STATUS.badRequest })
  }
  if (error instanceof RelayError) {
    const status =
      error.code === "rate_limited"
        ? STATUS.tooMany
        : error.code === "not_found"
          ? STATUS.notFound
          : STATUS.conflict
    return Response.json({ error: { code: error.code, message: error.message } }, { status })
  }
  if (error instanceof PaymentError) {
    const status =
      error.code === "not_found"
        ? STATUS.notFound
        : error.code === "bad_amount"
          ? STATUS.badRequest
          : STATUS.conflict
    return Response.json({ error: { code: error.code, message: error.message } }, { status })
  }
  if (error instanceof BusinessError) {
    return Response.json(
      { error: { code: error.field, message: error.message } },
      { status: STATUS.badRequest },
    )
  }
  if (error instanceof SandboxError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: STATUS.conflict },
    )
  }
  if (error instanceof OnboardError) {
    return Response.json(
      { error: { code: error.code, message: error.message } },
      { status: STATUS.conflict },
    )
  }
  console.error("[api]", error)
  return Response.json(
    { error: { code: "server_error", message: "Something went wrong on our side" } },
    { status: STATUS.serverError },
  )
}

/** Wrap a route handler: thrown errors become JSON problems; bigint values become strings. */
export function route<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<unknown>,
) {
  return async (request: Request, ...args: Args): Promise<Response> => {
    try {
      const result = await handler(request, ...args)
      if (result instanceof Response) return result
      return new Response(JSON.stringify(result, bigintToString), {
        headers: { "content-type": "application/json" },
      })
    } catch (error) {
      return toResponse(error)
    }
  }
}

const bigintToString = (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value
