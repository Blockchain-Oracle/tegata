import type { BaseLayoutProps, LinkItemType } from "fumadocs-ui/layouts/shared"

import { Seal } from "@/components/seal"

import { DOCS, SITE } from "./site"

/** The one filled action in the bar: the app itself, in the seal's vermilion. */
const openApp: LinkItemType = {
  type: "custom",
  secondary: true,
  children: (
    <a
      href={SITE.app}
      className="inline-flex h-8 items-center rounded-[10px] bg-shu px-3.5 text-[13px] font-semibold whitespace-nowrap text-black transition-opacity hover:opacity-85"
    >
      Open Tegata
    </a>
  ),
}

/** The bar on every page: the seal and the wordmark, "on NEAR", and the app. */
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-2.5">
          <Seal size={24} />
          <span className="display text-[21px] leading-none">{SITE.name}</span>
          <span aria-hidden className="h-4 w-px bg-fd-border" />
          <span className="flex items-center gap-1.5 text-[12px] font-medium text-fd-muted-foreground">
            on
            <img src="/marks/near.svg" alt="NEAR" className="size-4 rounded-[4px]" />
          </span>
        </span>
      ),
      url: "/",
    },
    links: [openApp],
  }
}

/** The front page's bar also names the docs' sections (inside the docs they're the tabs). */
export function homeOptions(): BaseLayoutProps {
  const base = baseOptions()
  return {
    ...base,
    links: [
      { text: "Start here", url: DOCS.start, active: "nested-url" },
      { text: "Guide", url: DOCS.guide, active: "nested-url" },
      { text: "How money moves", url: DOCS.money, active: "nested-url" },
      { text: "Build", url: DOCS.build, active: "nested-url" },
      openApp,
    ],
  }
}
