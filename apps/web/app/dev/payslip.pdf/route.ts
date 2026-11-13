import { type PayslipDocument, renderPayslipPdf } from "@tegata/documents"

/** /dev: the payslip PDF on sample data, for design review. `?chain=1` shows a row paid to another chain. */
export async function GET(request: Request) {
  const chain = new URL(request.url).searchParams.has("chain")
  const doc: PayslipDocument = {
    kind: "payslip",
    reference: "PS-7C1E09A4",
    business: {
      name: "Studio Kaze",
      address: "14 Admiralty Way, Lekki, Lagos",
      taxId: "TIN 23849102-0001",
      email: "hello@studio-kaze.example",
      logo: null,
      accountId: "studio-kaze.tegata.near",
    },
    person: {
      name: "Mei Tanaka",
      role: "Product designer",
      reference: "P-9F3A21",
      email: "m•••@studio-kaze.example",
    },
    periodLabel: "Pay · 1–30 Nov 2026",
    periodFrom: "2026-11-01",
    periodTo: "2026-11-30",
    payDate: "2026-11-28",
    paidAt: "28 Nov 2026, 09:02",
    timezone: "Africa/Lagos",
    frequency: "Monthly",
    gross: "2400000000",
    net: "2400000000",
    yearToDate: "26400000000",
    year: 2026,
    how: chain
      ? {
          paidIn: "USDT on Tron, converted by NEAR Intents",
          to: "TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE",
          toKind: "Address on Tron",
          delivered: "2,400 USDT",
          deliveryTx: "8f2c41d0a9b7e6c5d4f3a2b1c0e9d8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1",
          deliveryTxUrl:
            "https://tronscan.org/#/transaction/8f2c41d0a9b7e6c5d4f3a2b1c0e9d8f7a6b5c4d3e2f1a0b9c8d7e6f5a4b3c2d1",
          nearTx: "7hEg9DgZdEaq7e4AHtY9FZ4ReB3sveq5XwewiEanCKFr",
          nearTxUrl: "https://nearblocks.io/txns/7hEg9DgZdEaq7e4AHtY9FZ4ReB3sveq5XwewiEanCKFr",
          memo: "tegata:payroll:7c1e09a4-2b6d-4e8f-9a01-3c5d7e9f1b2a",
          autopilot: false,
        }
      : {
          paidIn: "USDC on NEAR, issued by Circle",
          to: "mei-tanaka.tegata.near",
          toKind: "Tegata account",
          delivered: null,
          deliveryTx: null,
          deliveryTxUrl: null,
          nearTx: "7hEg9DgZdEaq7e4AHtY9FZ4ReB3sveq5XwewiEanCKFr",
          nearTxUrl: "https://nearblocks.io/txns/7hEg9DgZdEaq7e4AHtY9FZ4ReB3sveq5XwewiEanCKFr",
          memo: "tegata:payroll:7c1e09a4-2b6d-4e8f-9a01-3c5d7e9f1b2a",
          autopilot: false,
        },
    checkUrl: "https://tegata.xyz/r/slip/7c1e09a4-2b6d-4e8f-9a01-3c5d7e9f1b2a",
    sandbox: false,
    madeAt: "28 Nov 2026, 09:03",
  }
  const pdf = await renderPayslipPdf(doc)
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": 'inline; filename="Payslip-sample.pdf"',
      "cache-control": "no-store",
      "x-robots-tag": "noindex",
    },
  })
}
