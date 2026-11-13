"use client"

// Import people from a CSV: pick a file or paste it, see every row before anything is saved, with each
// bad row and what to fix. Only the good rows are imported.
import { parsePeopleCsv } from "@tegata/core/payroll"
import { FileUp } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { Button } from "@/components/kit/button"
import { viewDollars } from "@/components/kit/figure"
import { Sheet } from "@/components/shell/sheet"

const SAMPLE =
  "name,email,role,amount\nMei Tanaka,mei@example.com,Designer,2400\nKofi Mensah,kofi@example.com,Engineer,3100"

export function ImportSheet({
  open,
  onOpenChange,
  importing,
  result,
  onImport,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  importing: boolean
  result: { added: number; problems: { line: number; message: string }[] } | null
  onImport: (csv: string) => void
}) {
  const [text, setText] = useState("")
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (open) setText("")
  }, [open])
  const parsed = useMemo(() => (text.trim() ? parsePeopleCsv(text) : null), [text])

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title="Import people">
      <div className="flex flex-col gap-4">
        {result ? (
          <div className="flex flex-col gap-3">
            <p className="text-[17px] font-semibold">
              Added {result.added} {result.added === 1 ? "person" : "people"}.
            </p>
            {result.problems.length ? (
              <Problems problems={result.problems} title="Not added" />
            ) : (
              <p className="text-[15px] text-muted-foreground">Every row went in.</p>
            )}
            <Button onClick={() => onOpenChange(false)}>Done</Button>
          </div>
        ) : (
          <>
            <p className="text-[15px] text-muted-foreground">
              A header row with <b className="text-foreground">name</b>,{" "}
              <b className="text-foreground">email</b>, <b className="text-foreground">role</b> and{" "}
              <b className="text-foreground">amount</b> (pay per run in dollars), then one person
              per line.
            </p>
            <input
              ref={file}
              type="file"
              accept=".csv,text/csv"
              className="sr-only"
              onChange={async (e) => {
                const picked = e.target.files?.[0]
                if (picked) setText(await picked.text())
                e.target.value = ""
              }}
            />
            <Button variant="secondary" size="md" onClick={() => file.current?.click()}>
              <FileUp /> Choose a CSV file
            </Button>
            <label htmlFor="people-csv" className="text-detail font-medium text-muted-foreground">
              Or paste it here
            </label>
            <textarea
              id="people-csv"
              rows={5}
              value={text}
              placeholder={SAMPLE}
              spellCheck={false}
              onChange={(e) => setText(e.target.value)}
              className="w-full resize-none rounded-[14px] bg-input px-4 py-3.5 font-mono text-[13px] outline-none placeholder:text-text-3 focus:bg-card focus:shadow-[0_0_0_2px_var(--shu)]"
            />
            {parsed ? (
              <div className="flex flex-col gap-3">
                {parsed.rows.length ? (
                  <div className="overflow-hidden rounded-[14px] bg-secondary">
                    {parsed.rows.map((row) => (
                      <div
                        key={row.line}
                        className="flex items-center justify-between gap-3 border-b border-background px-3 py-2 text-[14px] last:border-0"
                      >
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-semibold">{row.name}</span>
                          <span className="truncate text-[12px] text-muted-foreground">
                            {[
                              row.email ?? "No email",
                              row.role,
                              row.kind === "contractor" ? "Contractor" : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <span className="tnum font-semibold">
                          ${viewDollars(row.amount).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {parsed.problems.length ? (
                  <Problems problems={parsed.problems} title="Fix these first" />
                ) : null}
                <Button
                  busy={importing}
                  disabled={!parsed.rows.length}
                  onClick={() => onImport(text)}
                >
                  Import {parsed.rows.length} {parsed.rows.length === 1 ? "person" : "people"}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </Sheet>
  )
}

function Problems({
  problems,
  title,
}: {
  problems: { line: number; message: string }[]
  title: string
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[14px] bg-down-surface p-3">
      <span className="text-[13px] font-semibold text-down">{title}</span>
      {problems.map((problem) => (
        <span key={`${problem.line}:${problem.message}`} className="text-[14px] text-down">
          Line {problem.line}: {problem.message}
        </span>
      ))}
    </div>
  )
}
