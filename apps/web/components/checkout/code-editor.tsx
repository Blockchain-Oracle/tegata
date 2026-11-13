"use client"

// A code sample the way an editor shows it: file tabs, line numbers and colour on a sumi panel (in both themes, like
// a terminal), in Tegata's own palette: vermilion tags, kin attributes, matcha strings, sora keywords. A small
// highlighter for the HTML and JSX the Checkout page hands out, so no highlighting library ships.
import { Check, Copy } from "lucide-react"
import { useState } from "react"

import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

export interface CodeFile {
  id: string
  /** The tab's file name: "index.html", "PayButton.tsx". */
  name: string
  code: string
}

const COPIED_MS = 1500

const TOKEN =
  /(?<comment><!--[\s\S]*?-->|\/\/[^\n]*)|(?<str>"[^"]*"|'[^']*'|`[^`]*`)|(?<tag><\/?[A-Za-z][\w.-]*|\/?>)|(?<kw>\b(?:import|from|export|function|const|return|default)\b)|(?<attr>[A-Za-z_][\w-]*(?==))|(?<fn>\b[A-Za-z_]\w*(?=\())|(?<punc>[{}()[\];,.=])/g

const COLOR: Record<string, string> = {
  comment: "text-[#7d7466] italic",
  str: "text-[#c8f06a]",
  tag: "text-[#ff7a3d]",
  kw: "text-[#a9d8ff]",
  attr: "text-[#ffd23f]",
  fn: "text-[#ffc2d6]",
  punc: "text-[#8a8275]",
}

function highlight(line: string) {
  const out: React.ReactNode[] = []
  let last = 0
  for (const match of line.matchAll(TOKEN)) {
    const index = match.index ?? 0
    if (index > last) out.push(line.slice(last, index))
    const kind = Object.entries(match.groups ?? {}).find(([, v]) => v !== undefined)?.[0]
    out.push(
      <span key={index} className={kind ? COLOR[kind] : undefined}>
        {match[0]}
      </span>,
    )
    last = index + match[0].length
  }
  if (last < line.length) out.push(line.slice(last))
  return out
}

export function CodeEditor({
  files,
  value,
  onValueChange,
  footnote,
}: {
  files: CodeFile[]
  value: string
  onValueChange: (id: string) => void
  footnote?: React.ReactNode
}) {
  const [copied, setCopied] = useState(false)
  const file = files.find((f) => f.id === value) ?? files[0]
  if (!file) return null
  const lines = file.code.split("\n")

  const copy = async () => {
    await navigator.clipboard.writeText(file.code)
    fire("tick", { cue: "confirmed" })
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }

  return (
    <section className="overflow-hidden rounded-[20px] bg-[#16130f] text-[#f3efe6] shadow-object ring-1 ring-white/5">
      <div className="flex items-center justify-between gap-3 border-white/8 border-b px-3 pt-3">
        <div className="flex min-w-0 gap-1 overflow-x-auto" role="tablist" aria-label="Code">
          {files.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={f.id === file.id}
              onClick={() => {
                fire("tick")
                onValueChange(f.id)
              }}
              className={cn(
                "press relative shrink-0 rounded-t-[10px] px-3.5 py-2 font-mono text-[13px] transition-colors",
                f.id === file.id
                  ? "bg-[#221d17] text-[#f3efe6]"
                  : "text-[#8a8275] hover:text-[#f3efe6]",
              )}
            >
              {f.name}
              {f.id === file.id ? (
                <span className="absolute inset-x-3 -bottom-px h-[2px] rounded-full bg-[#ff4f00]" />
              ) : null}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void copy()}
          className="press mb-2 inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-[13px] font-semibold hover:bg-white/12 [&_svg]:size-3.5"
        >
          {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto bg-[#221d17] px-0 py-4 font-mono text-[13px] leading-[1.75]">
        <code className="grid">
          {lines.map((line, i) => (
            // Each line keeps its number in a fixed gutter so long lines scroll, numbers don't.
            // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional and never reordered.
            <span key={i} className="grid grid-cols-[3rem_1fr] pr-5">
              <span className="select-none pr-4 text-right text-[#5b544a]">{i + 1}</span>
              <span className="whitespace-pre">{highlight(line)}</span>
            </span>
          ))}
        </code>
      </pre>
      {footnote ? (
        <div className="border-white/8 border-t px-4 py-3 text-[13px] text-[#a79e90]">
          {footnote}
        </div>
      ) : null}
    </section>
  )
}
