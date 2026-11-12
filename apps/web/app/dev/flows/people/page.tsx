"use client"

// People in every state (plan 6.9): the team list (a mix of ready, waiting, getting ready and a change on its way;
// none yet; loading; error), the add sheet, the CSV import, a person's sheet, the person's own page (choosing,
// set, a change waiting) and their payslip, on sample data that lives only under /dev.
import { useState } from "react"

import { Button } from "@/components/kit/button"
import { Segmented } from "@/components/kit/segmented"
import { ImportSheet } from "@/components/people/import-sheet"
import { PeopleView } from "@/components/people/people-view"
import { PersonPageView } from "@/components/people/person-page-view"
import { AddPersonSheet, PersonSheet } from "@/components/people/person-sheet"
import { ReceiptView } from "@/components/receipt/receipt-view"
import type { TeamPerson } from "@/lib/client/types"
import { SAMPLE_PAYSLIP, SAMPLE_PEOPLE, SAMPLE_PERSON_PAGE, SAMPLE_SLIPS } from "@/lib/dev/sample"

type State = "mix" | "empty" | "loading" | "error"
type PageState = "choose" | "set" | "pending" | "no-email"

export default function PeopleFlow() {
  const [state, setState] = useState<State>("mix")
  const [page, setPage] = useState<PageState>("choose")
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [open, setOpen] = useState<TeamPerson | null>(null)

  const personPage =
    page === "choose"
      ? SAMPLE_PERSON_PAGE
      : page === "no-email"
        ? { ...SAMPLE_PERSON_PAGE, emailHint: null }
        : {
            ...SAMPLE_PERSON_PAGE,
            claimed: true,
            ready: {
              state: "ready" as const,
              kind: "tegata" as const,
              accountId: "mei.tegata.testnet",
            },
            pending:
              page === "pending"
                ? {
                    kind: "near" as const,
                    accountId: "mei-tanaka.testnet",
                    activatesAt: new Date(Date.now() + 22 * 3_600_000).toISOString(),
                  }
                : null,
            slips: SAMPLE_SLIPS,
          }

  return (
    <div className="flex flex-col gap-12 pt-6">
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-[30px]">People</span>
          <Segmented
            label="State"
            value={state}
            onValueChange={(v) => setState(v as State)}
            options={[
              { value: "mix", label: "A team" },
              { value: "empty", label: "None yet" },
              { value: "loading", label: "Loading" },
              { value: "error", label: "Error" },
            ]}
          />
        </div>
        <PeopleView
          people={state === "mix" ? SAMPLE_PEOPLE : state === "empty" ? [] : undefined}
          error={state === "error"}
          onRetry={() => setState("mix")}
          onAdd={() => setAdding(true)}
          onImport={() => setImporting(true)}
          onOpen={setOpen}
        />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" onClick={() => setAdding(true)}>
            Add sheet
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setImporting(true)}>
            Import sheet
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setOpen(SAMPLE_PEOPLE[1] ?? null)}>
            A person with a change waiting
          </Button>
        </div>
        <AddPersonSheet
          open={adding}
          onOpenChange={setAdding}
          emailEnabled={false}
          saving={false}
          problem={null}
          onSave={() => setAdding(false)}
        />
        <ImportSheet
          open={importing}
          onOpenChange={setImporting}
          importing={false}
          result={null}
          onImport={() => setImporting(false)}
        />
        <PersonSheet
          person={open}
          slips={SAMPLE_SLIPS}
          onOpenChange={(o) => !o && setOpen(null)}
          saving={false}
          problem={null}
          onSave={() => undefined}
          onSetAccount={() => undefined}
          settingAccount={false}
          accountProblem={null}
          onRemove={() => setOpen(null)}
          removing={false}
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="display text-[30px]">The page they open</span>
          <Segmented
            label="Page state"
            value={page}
            onValueChange={(v) => setPage(v as PageState)}
            options={[
              { value: "choose", label: "Choosing" },
              { value: "set", label: "Set" },
              { value: "pending", label: "Change waiting" },
              { value: "no-email", label: "No email" },
            ]}
          />
        </div>
        <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-[28px] ring-1 ring-secondary">
          <PersonPageView
            key={page}
            page={personPage}
            busy={false}
            problem={null}
            onTegata={() => setPage("set")}
            onNear={() => setPage("set")}
          />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <span className="display text-[30px]">Their payslip</span>
        <div className="overflow-hidden rounded-[24px]">
          <ReceiptView receipt={SAMPLE_PAYSLIP} token="dev:slip" />
        </div>
      </section>
    </div>
  )
}
