import { Accordion, Accordions } from "fumadocs-ui/components/accordion"
import { ImageZoom } from "fumadocs-ui/components/image-zoom"
import { Step, Steps } from "fumadocs-ui/components/steps"
import { Tab, Tabs } from "fumadocs-ui/components/tabs"
import defaultMdxComponents from "fumadocs-ui/mdx"
import { icons } from "lucide-react"
import type { MDXComponents } from "mdx/types"
import type { ComponentProps } from "react"

import { Diagram } from "./diagram"
import { Mark, Marquee } from "./marks"
import { Phone, Phones, Shot } from "./phone"
import { Seal, Stage } from "./seal"

/** A lucide icon by name, so .mdx files can write `icon={<Icon name="Link2" />}` without imports. */
function Icon({ name, ...props }: { name: keyof typeof icons } & ComponentProps<"svg">) {
  const Glyph = icons[name]
  // A name lucide doesn't have renders nothing rather than breaking the page.
  return Glyph ? <Glyph {...props} /> : null
}

/** A transaction on the NEAR testnet explorer, shown short. */
function Tx({ hash }: { hash: string }) {
  return (
    <a
      href={`https://testnet.nearblocks.io/txns/${hash}`}
      target="_blank"
      rel="noreferrer"
      className="font-mono text-[0.92em]"
    >
      {hash.slice(0, 6)}…{hash.slice(-6)}
    </a>
  )
}

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    img: (props: ComponentProps<"img">) => (
      <ImageZoom {...(props as ComponentProps<typeof ImageZoom>)} />
    ),
    Accordion,
    Accordions,
    Step,
    Steps,
    Tab,
    Tabs,
    Diagram,
    Mark,
    Marquee,
    Phone,
    Phones,
    Shot,
    Seal,
    Stage,
    Icon,
    Tx,
    ...components,
  } satisfies MDXComponents
}

export const useMDXComponents = getMDXComponents

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>
}
