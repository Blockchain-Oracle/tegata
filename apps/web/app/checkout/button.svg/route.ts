import {
  PAY_BUTTON_SIZES,
  PAY_BUTTON_THEMES,
  type PayButtonSize,
  type PayButtonTheme,
  payButtonSvg,
} from "@/lib/brand/pay-button"

const AMOUNT = /^\d{1,9}(\.\d{1,2})?$/

/**
 * The Tegata pay button as an image: `?amount=42.50&theme=shu|ink|washi&size=s|m|l&coins=0`. checkout.js draws it;
 * a site without JavaScript can link it to a pay page as is.
 */
export function GET(request: Request) {
  const query = new URL(request.url).searchParams
  const amount = query.get("amount")
  const theme = query.get("theme")
  const size = query.get("size")
  const svg = payButtonSvg({
    amount: amount && AMOUNT.test(amount) ? amount : null,
    theme: PAY_BUTTON_THEMES.includes(theme as PayButtonTheme) ? (theme as PayButtonTheme) : "shu",
    size: PAY_BUTTON_SIZES.includes(size as PayButtonSize) ? (size as PayButtonSize) : "m",
    coins: query.get("coins") !== "0",
  })
  return new Response(svg, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=86400",
      "access-control-allow-origin": "*",
    },
  })
}
