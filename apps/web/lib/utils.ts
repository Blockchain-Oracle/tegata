import { type ClassValue, clsx } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

/**
 * Class merging that knows Tegata's type roles (globals.css `--text-*`). Without this, tailwind-merge reads
 * `text-button` or `text-row` as a colour and drops the real colour class next to it (a black button with a
 * black label).
 */
const merge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        {
          text: [
            "display-hero",
            "display-balance",
            "display-price",
            "page-title",
            "step-title",
            "sheet-title",
            "section-title",
            "button",
            "row",
            "detail",
            "meta",
          ],
        },
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return merge(clsx(inputs))
}
