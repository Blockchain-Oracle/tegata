import { type Db, schema } from "@tegata/db"
import { eq } from "drizzle-orm"

const { workspaces } = schema

/** What fits on a receipt or invoice header. */
export const BUSINESS_LIMITS = {
  nameMin: 2,
  nameMax: 60,
  address: 300,
  taxId: 40,
  email: 120,
  /** Decoded logo size. */
  logoBytes: 200_000,
} as const

const LOGO = /^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+=*)$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const BASE64_RATIO = 3 / 4

export type BusinessField = "name" | "address" | "taxId" | "email" | "timezone" | "logo"

export class BusinessError extends Error {
  constructor(
    readonly field: BusinessField,
    message: string,
  ) {
    super(message)
  }
}

export interface BusinessInput {
  name: string
  address?: string | null
  taxId?: string | null
  email?: string | null
  timezone: string
  /** A data URL to set, null to remove, absent to keep. */
  logo?: string | null
}

export function validTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

/** A logo data URL decoded, or null when it isn't a small PNG, JPEG or WebP. */
export function decodeLogo(dataUrl: string): { type: string; bytes: Buffer } | null {
  const match = LOGO.exec(dataUrl)
  if (!match?.[1] || !match[2]) return null
  if (match[2].length * BASE64_RATIO > BUSINESS_LIMITS.logoBytes) return null
  return { type: `image/${match[1]}`, bytes: Buffer.from(match[2], "base64") }
}

const blank = (value: string | null | undefined) => {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

/** Update the business's profile: what every receipt and invoice header shows. */
export async function updateBusiness(db: Db, ownerId: string, input: BusinessInput) {
  const name = input.name.trim()
  if (name.length < BUSINESS_LIMITS.nameMin || name.length > BUSINESS_LIMITS.nameMax)
    throw new BusinessError("name", "Use 2 to 60 characters")
  const address = blank(input.address)
  if (address && address.length > BUSINESS_LIMITS.address)
    throw new BusinessError("address", "Keep the address under 300 characters")
  const taxId = blank(input.taxId)
  if (taxId && taxId.length > BUSINESS_LIMITS.taxId)
    throw new BusinessError("taxId", "Keep the tax ID under 40 characters")
  const email = blank(input.email)
  if (email && (email.length > BUSINESS_LIMITS.email || !EMAIL.test(email)))
    throw new BusinessError("email", "Enter an email like accounts@studio.com")
  if (!validTimezone(input.timezone)) throw new BusinessError("timezone", "Pick a time zone")
  if (input.logo && !decodeLogo(input.logo))
    throw new BusinessError("logo", "Use a PNG, JPEG or WebP under 200 KB")

  const [row] = await db
    .update(workspaces)
    .set({
      name,
      address,
      taxId,
      email,
      timezone: input.timezone,
      ...(input.logo === undefined ? {} : { logoUrl: input.logo }),
    })
    .where(eq(workspaces.ownerId, ownerId))
    .returning()
  if (!row) throw new BusinessError("name", "Name your business first")
  return row
}

export async function businessLogo(db: Db, workspaceId: string) {
  const [row] = await db
    .select({ logo: workspaces.logoUrl })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
  return row?.logo ? decodeLogo(row.logo) : null
}

/** Where a business's logo is served, versioned so a new logo replaces the cached one. */
export const logoPath = (workspace: { id: string; logoUrl: string | null; updatedAt: Date }) =>
  workspace.logoUrl ? `/api/logo/${workspace.id}?v=${workspace.updatedAt.getTime()}` : null
