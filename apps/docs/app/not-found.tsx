import { HomeLayout } from "fumadocs-ui/layouts/home"
import Link from "next/link"

import { Seal } from "@/components/seal"
import { homeOptions } from "@/lib/layout.shared"
import { DOCS } from "@/lib/site"

/** A missing page (exported as 404.html, which nginx serves for anything it can't find). */
export default function NotFound() {
  return (
    <HomeLayout {...homeOptions()}>
      <main className="flex flex-1 flex-col items-center justify-center gap-5 px-4 py-24 text-center">
        <Seal size={72} tilt={-8} />
        <h1 className="display text-5xl">Nothing here.</h1>
        <p className="max-w-sm text-fd-muted-foreground">
          This page moved or never existed. The docs start with a paid invoice in five minutes.
        </p>
        <Link
          href={DOCS.start}
          className="inline-flex h-11 items-center rounded-[12px] bg-shu px-5 text-[15px] font-semibold text-black"
        >
          Start here
        </Link>
      </main>
    </HomeLayout>
  )
}
