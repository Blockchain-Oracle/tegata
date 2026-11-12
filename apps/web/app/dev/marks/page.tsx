import { MARKS, Mark, MarkStack } from "@/components/marks/mark"

import { Section, Specimen } from "../dev-chrome"

const PAIRS = [
  ["usdt", "tron"],
  ["usdc", "base"],
  ["usdc", "sol"],
  ["eth", "arb"],
  ["usdc", "near"],
  ["btc", "btc"],
] as const

export default function MarksPage() {
  return (
    <div className="flex flex-col">
      <Section
        title="Every logo"
        note="Real marks in their own colours, never tinted, never a letter disc where a mark exists. Sources and licences are in public/marks/PROVENANCE.md."
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          {Object.entries(MARKS).map(([id, name]) => (
            <div key={id} className="flex flex-col items-center gap-2 rounded-[16px] bg-card p-4">
              <Mark id={id} size={44} />
              <span className="text-center text-meta font-medium text-muted-foreground">
                {name}
              </span>
            </div>
          ))}
        </div>
      </Section>
      <Section
        title="Coin on chain"
        note="A chain badge in the corner, as on the pay page's picker."
      >
        <div className="flex flex-wrap gap-4">
          {PAIRS.map(([coin, chain]) => (
            <Specimen
              key={`${coin}-${chain}`}
              label={`${MARKS[coin]} on ${MARKS[chain]}`}
              className="items-center"
            >
              <Mark id={coin} chain={chain} size={56} />
            </Specimen>
          ))}
        </div>
      </Section>
      <Section title="Stacks" note="'Pay from any of these.'">
        <Specimen label="Pay-in chains">
          <MarkStack ids={["eth", "base", "sol", "arb", "btc", "tron", "pol", "near"]} size={40} />
        </Specimen>
      </Section>
    </div>
  )
}
