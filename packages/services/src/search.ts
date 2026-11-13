// ⌘K search across one business's invoices (by number or customer), customers, people and pay links (plan 6.7).
import { invoiceNumber } from "@tegata/core/invoices"
import { type Db, schema } from "@tegata/db"
import { and, desc, eq, ilike, ne, or } from "drizzle-orm"

const { invoices, customers, people, requests } = schema
const EACH = 5

export interface SearchResults {
  invoices: { id: string; label: string; customer: string | null; status: string }[]
  customers: { id: string; name: string }[]
  people: { id: string; name: string; role: string | null }[]
  links: { id: string; title: string }[]
}

export async function searchWorkspace(
  db: Db,
  workspaceId: string,
  query: string,
): Promise<SearchResults> {
  const q = query.trim()
  if (q.length < 2) return { invoices: [], customers: [], people: [], links: [] }
  const like = `%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`
  // "INV-0004", "inv 4" or "4" all find invoice number 4.
  const digits = /^(?:inv[-\s]*)?0*(\d{1,7})$/i.exec(q)?.[1]
  const [foundInvoices, foundCustomers, foundPeople, foundLinks] = await Promise.all([
    db
      .select({
        id: invoices.id,
        number: invoices.number,
        status: invoices.status,
        customer: customers.name,
      })
      .from(invoices)
      .leftJoin(customers, eq(customers.id, invoices.customerId))
      .where(
        and(
          eq(invoices.workspaceId, workspaceId),
          or(ilike(customers.name, like), ...(digits ? [eq(invoices.number, Number(digits))] : [])),
        ),
      )
      .orderBy(desc(invoices.createdAt))
      .limit(EACH),
    db
      .select({ id: customers.id, name: customers.name })
      .from(customers)
      .where(and(eq(customers.workspaceId, workspaceId), ilike(customers.name, like)))
      .limit(EACH),
    db
      .select({ id: people.id, name: people.name, role: people.role })
      .from(people)
      .where(
        and(
          eq(people.workspaceId, workspaceId),
          ne(people.status, "removed"),
          or(ilike(people.name, like), ilike(people.role, like)),
        ),
      )
      .limit(EACH),
    db
      .select({ id: requests.id, title: requests.title })
      .from(requests)
      .where(
        and(
          eq(requests.workspaceId, workspaceId),
          eq(requests.kind, "link"),
          ilike(requests.title, like),
        ),
      )
      .limit(EACH),
  ])
  return {
    invoices: foundInvoices.map((row) => ({
      id: row.id,
      label: row.number ? invoiceNumber(row.number) : "Draft invoice",
      customer: row.customer,
      status: row.status,
    })),
    customers: foundCustomers,
    people: foundPeople,
    links: foundLinks,
  }
}
