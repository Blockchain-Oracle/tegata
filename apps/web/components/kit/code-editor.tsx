"use client"

// Every code sample in Tegata, the way an editor shows it: file tabs, line numbers and colour on a sumi panel (in both
// themes, like a terminal), in Tegata's own palette: vermilion commands and tags, kin keys and attributes, matcha
// strings, sora keywords and flags, sakura functions, stage-light numbers. One small highlighter for the shell, JSON,
// JavaScript, JSX, HTML and Python the app hands out, so no highlighting library ships.
import { Check, Copy } from "lucide-react"
import { useState } from "react"

import { fire } from "@/lib/feedback"
import { cn } from "@/lib/utils"

export interface CodeFile {
  id: string
  /** The tab's file name: "index.html", "checkout.sh". */
  name: string
  code: string
}

const COPIED_MS = 1500

// Earlier groups win at the same position; matching runs left to right, so a string swallows a `#` or `//` inside it.
const TOKEN = new RegExp(
  [
    String.raw`(?<comment><!--[\s\S]*?-->|\/\/[^\n]*|(?<![\w"'#&])#(?=\s|$)[^\n]*)`,
    String.raw`(?<key>"[^"\n]*"(?=\s*:))`,
    String.raw`(?<str>"[^"\n]*"|'[^'\n]*'|` + "`[^`\\n]*`" + `)`,
    String.raw`(?<url>https?:\/\/[^\s"'\\<>)]+)`,
    String.raw`(?<tag><\/?[A-Za-z][\w.-]*|\/?>)`,
    String.raw`(?<cmd>(?<![\w./-])(?:curl|npm|pnpm|pip)(?![\w-]))`,
    String.raw`(?<flag>(?<=\s)--?[A-Za-z][\w-]*)`,
    String.raw`(?<variable>\$[A-Za-z_]\w*)`,
    String.raw`(?<kw>\b(?:import|from|export|function|const|let|return|default|async|await|new|if|else|def|raise|for|in|not|and|or|with|as|True|False|None|true|false|null)\b)`,
    String.raw`(?<attr>[A-Za-z_][\w-]*(?==))`,
    String.raw`(?<fn>\b[A-Za-z_]\w*(?=\())`,
    String.raw`(?<num>\b\d+(?:\.\d+)?\b)`,
    String.raw`(?<punc>[{}()[\];,.=:\\])`,
  ].join("|"),
  "g",
)

const COLOR: Record<string, string> = {
  comment: "text-[#7d7466] italic",
  key: "text-[#ffd23f]",
  str: "text-[#c8f06a]",
  url: "text-[#a9d8ff] underline decoration-[#a9d8ff]/35 underline-offset-[3px]",
  tag: "text-[#ff7a3d]",
  cmd: "font-semibold text-[#ff7a3d]",
  flag: "text-[#a9d8ff]",
  variable: "text-[#ffd23f]",
  kw: "text-[#a9d8ff]",
  attr: "text-[#ffd23f]",
  fn: "text-[#ffc2d6]",
  num: "text-[#ffb38a]",
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

function useCopy(text: string) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    fire("tick", { cue: "confirmed" })
    setCopied(true)
    setTimeout(() => setCopied(false), COPIED_MS)
  }
  return { copied, copy }
}

function CopyPill({
  copied,
  onCopy,
  label,
}: {
  copied: boolean
  onCopy: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={onCopy}
      className="press inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/8 px-3 py-1.5 text-[13px] font-semibold text-[#f3efe6] hover:bg-white/12 [&_svg]:size-3.5"
    >
      {copied ? <Check /> : <Copy />} {copied ? "Copied" : "Copy"}
    </button>
  )
}

export function CodeEditor({
  files,
  value,
  onValueChange,
  footnote,
  className,
}: {
  files: CodeFile[]
  value: string
  onValueChange: (id: string) => void
  footnote?: React.ReactNode
  className?: string
}) {
  const file = files.find((f) => f.id === value) ?? files[0]
  const { copied, copy } = useCopy(file?.code ?? "")
  if (!file) return null
  const lines = file.code.split("\n")

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[20px] bg-[#16130f] text-[#f3efe6] shadow-object ring-1 ring-white/5",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-3 border-white/8 border-b px-3 pt-3">
        <div className="flex min-w-0 gap-1 overflow-x-auto" role="tablist" aria-label="Code">
          {files.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={f.id === file.id}
              onClick={() => {
                if (f.id === file.id) return
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
        <div className="mb-2">
          <CopyPill copied={copied} onCopy={() => void copy()} label={file.name} />
        </div>
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

/** A code sample that keeps its own tab: the same editor, for pages that don't need to know which file is open. */
export function CodeSample({
  files,
  footnote,
  className,
}: {
  files: CodeFile[]
  footnote?: React.ReactNode
  className?: string
}) {
  const [tab, setTab] = useState(files[0]?.id ?? "")
  return (
    <CodeEditor
      files={files}
      value={tab}
      onValueChange={setTab}
      footnote={footnote}
      className={className}
    />
  )
}

/** A key or secret shown once: one line on the sumi panel, the value in kin, with Copy. */
export function SecretLine({ value, label }: { value: string; label: string }) {
  const { copied, copy } = useCopy(value)
  return (
    <div className="flex items-center gap-3 rounded-[16px] bg-[#16130f] py-2.5 pr-2.5 pl-4 ring-1 ring-white/5">
      <code className="min-w-0 flex-1 break-all font-mono text-[13.5px] text-[#ffd23f]">
        {value}
      </code>
      <CopyPill copied={copied} onCopy={() => void copy()} label={label} />
    </div>
  )
}
