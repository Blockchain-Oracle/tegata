"use client"

// People: what one run pays everyone on the stage, then one row per person with their pay and where it
// lands. Each row opens the person's sheet. Empty: a matcha tile. Separate from its data so /dev/flows can show every
// state.
import { ChevronRight, FileUp, Plus, Users } from "lucide-react"
import { motion, useReducedMotion } from "motion/react"

import { CustomerDisc } from "@/components/invoices/customer-picker"
import { Button } from "@/components/kit/button"
import { Figure, viewDollars } from "@/components/kit/figure"
import { Stage } from "@/components/kit/stage"
import { EmptyState, ErrorState, LoadingShape } from "@/components/kit/states"
import { MarkStack } from "@/components/marks/mark"
import { DestinationPill } from "@/components/people/destination"
import type { TeamPerson } from "@/lib/client/types"

export function PeopleView({
  people,
  error,
  onRetry,
  onAdd,
  onImport,
  onOpen,
}: {
  people: TeamPerson[] | undefined
  error: boolean
  onRetry: () => void
  onAdd: () => void
  onImport: () => void
  onOpen: (person: TeamPerson) => void
}) {
  const reduce = useReducedMotion()
  const list = people ?? []
  const perRun = list.reduce((sum, p) => sum + BigInt(p.amount), 0n)
  const ready = list.filter((p) => p.ready.state === "ready").length

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="display text-page-title">People</h1>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="md" onClick={onImport}>
            <FileUp /> Import CSV
          </Button>
          <Button variant="shu" size="md" onClick={onAdd}>
            <Plus /> Add person
          </Button>
        </div>
      </header>

      {error ? (
        <ErrorState
          title="Couldn't load your team"
          detail="Nobody's pay changes while this is down."
          onRetry={onRetry}
        />
      ) : people === undefined ? (
        <div className="flex flex-col gap-4">
          <LoadingShape shape="card" className="h-[150px] rounded-[24px]" />
          <div className="rounded-[20px] bg-card p-3">
            <LoadingShape shape="list" />
          </div>
        </div>
      ) : people.length === 0 ? (
        <EmptyState
          art={<Users />}
          field="matcha"
          title="Add the people you pay"
          detail="They get a link, sign in with their email, and choose where their pay lands. No wallet needed."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button variant="shu" onClick={onAdd}>
                <Plus /> Add person
              </Button>
              <Button variant="secondary" onClick={onImport}>
                <FileUp /> Import CSV
              </Button>
            </div>
          }
        />
      ) : (
        <>
          <Stage className="p-6 sm:p-8">
            <div className="flex flex-col gap-1">
              <span className="inline-flex items-center gap-2 text-[15px] font-medium text-white/85">
                <MarkStack ids={["usdc", "near"]} size={22} /> Pay per run
              </span>
              <Figure
                value={viewDollars(perRun)}
                className="text-[56px] text-white sm:text-[72px]"
              />
              <span className="text-[15px] font-medium text-white/85">
                {list.length} {list.length === 1 ? "person" : "people"} · {ready} ready ·{" "}
                {list.length - ready} waiting
              </span>
            </div>
          </Stage>
          <div className="flex flex-col rounded-[20px] bg-card p-2">
            {list.map((person, i) => (
              <motion.button
                key={person.id}
                type="button"
                onClick={() => onOpen(person)}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
                className="press flex items-center gap-3 rounded-[14px] px-3 py-3 text-left hover:bg-secondary"
              >
                <CustomerDisc name={person.name} size={44} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[16px] font-semibold">{person.name}</span>
                  <span className="truncate text-detail text-muted-foreground">
                    {[
                      person.role ?? person.email ?? "No email",
                      person.kind === "contractor" ? "Contractor" : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <span className="hidden sm:inline-flex">
                  <DestinationPill
                    ready={person.ready}
                    pending={person.pending}
                    hasEmail={Boolean(person.email)}
                  />
                </span>
                <span className="flex flex-col items-end">
                  <span className="tnum text-[16px] font-semibold">
                    $
                    {viewDollars(person.amount).toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                  <span className="text-[12px] text-muted-foreground sm:hidden">
                    {person.ready.state === "ready" ? "Ready" : "Not ready"}
                  </span>
                </span>
                <ChevronRight className="size-4 text-text-3" />
              </motion.button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
