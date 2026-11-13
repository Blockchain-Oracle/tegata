/*!
 * Tegata Checkout. Put a pay button on any site:
 *
 *   <script src="https://tegata.xyz/checkout.js" defer></script>
 *   <button data-tegata-link="k3Fq9Xr2pT"></button>                 a pay link (a fixed price, or set data-tegata-amount)
 *   <button data-tegata-session="https://tegata.xyz/pay/E32D…"></button>   a checkout session your server made
 *
 * The customer pays from any wallet on any chain (NEAR Intents) and you receive USDC on NEAR. An empty element gets
 * Tegata's own button; one with content keeps yours. Or open it yourself: Tegata.checkout({ link, amount, onPaid }).
 * The "paid" event is for your screens only: confirm the order from the signed webhook (or GET the session).
 */
;(() => {
  if (window.Tegata?.checkout) return
  const script = document.currentScript
  const ORIGIN = script?.src ? new URL(script.src).origin : "https://tegata.xyz"
  const TOKEN = /^[A-Za-z0-9_-]{6,64}$/

  /** A pay link token, or a checkout session's pay URL (or its token), as a /checkout/<token> URL. */
  function checkoutUrl(options) {
    let token = options.link || ""
    if (options.session) {
      const match = String(options.session).match(/\/pay\/([A-Za-z0-9_-]+)/)
      token = match ? match[1] : String(options.session)
    }
    if (!TOKEN.test(token))
      throw new Error("Tegata Checkout: give a pay link token or a session's pay URL")
    const url = new URL(`/checkout/${token}`, ORIGIN)
    url.searchParams.set("parent", window.location.origin)
    if (options.amount) url.searchParams.set("amount", String(options.amount))
    return { url: url.toString(), token }
  }

  let openSheet = null

  function close(reason) {
    if (!openSheet) return
    const sheet = openSheet
    openSheet = null
    window.removeEventListener("message", sheet.onMessage)
    document.removeEventListener("keydown", sheet.onKey)
    sheet.root.remove()
    document.documentElement.style.overflow = sheet.overflow
    sheet.returnFocus?.focus?.()
    sheet.options.onClose?.({ reason })
    sheet.target?.dispatchEvent(new CustomEvent("tegata:closed", { bubbles: true }))
  }

  /** Open the pay page over this page. */
  function checkout(options = {}) {
    close("replaced")
    const { url, token } = checkoutUrl(options)
    const phone = window.matchMedia("(max-width: 520px)").matches
    const root = document.createElement("div")
    root.setAttribute("role", "dialog")
    root.setAttribute("aria-modal", "true")
    root.setAttribute("aria-label", "Pay with Tegata")
    Object.assign(root.style, {
      position: "fixed",
      inset: "0",
      zIndex: "2147483000",
      background: "rgba(0,0,0,0.45)",
      display: "flex",
      alignItems: phone ? "flex-end" : "center",
      justifyContent: "center",
    })
    const frame = document.createElement("iframe")
    frame.src = url
    frame.title = "Pay with Tegata"
    frame.allow = "clipboard-write; payment"
    Object.assign(frame.style, {
      border: "0",
      background: "#fff",
      width: phone ? "100%" : "min(460px, calc(100vw - 32px))",
      height: phone ? "92dvh" : "min(780px, calc(100dvh - 32px))",
      borderRadius: phone ? "24px 24px 0 0" : "24px",
      boxShadow: "0 24px 80px rgba(0,0,0,0.35)",
    })
    root.appendChild(frame)
    root.addEventListener("click", (event) => {
      if (event.target === root) close("backdrop")
    })
    const onMessage = (event) => {
      if (event.origin !== ORIGIN || event.source !== frame.contentWindow) return
      const data = event.data || {}
      if (data.token !== token) return
      if (data.type === "tegata:checkout.close") close("closed")
      if (data.type === "tegata:checkout.completed") {
        options.onPaid?.(data.detail)
        options.target?.dispatchEvent(
          new CustomEvent("tegata:paid", { bubbles: true, detail: data.detail }),
        )
      }
    }
    const onKey = (event) => {
      if (event.key === "Escape") close("escape")
    }
    window.addEventListener("message", onMessage)
    document.addEventListener("keydown", onKey)
    openSheet = {
      root,
      options,
      onMessage,
      onKey,
      target: options.target,
      returnFocus: document.activeElement,
      overflow: document.documentElement.style.overflow,
    }
    document.documentElement.style.overflow = "hidden"
    document.body.appendChild(root)
    frame.focus()
  }

  const dollars = (value) =>
    Number(value).toLocaleString("en-US", { style: "currency", currency: "USD" })

  /** Tegata's own button, in Shadow DOM so the page's CSS can't change it. */
  function drawButton(el) {
    if (el.shadowRoot || el.childElementCount || el.textContent.trim()) return
    const dark = el.getAttribute("data-tegata-theme") === "dark"
    const amount = el.getAttribute("data-tegata-amount")
    const label =
      el.getAttribute("data-tegata-label") || (amount ? `Pay ${dollars(amount)}` : "Pay")
    // A <button> can't hold a shadow root, so the drawing lives in a span inside it; the element itself loses only
    // the browser's default button look.
    Object.assign(el.style, { background: "none", border: "0", padding: "0", cursor: "pointer" })
    const host = document.createElement("span")
    el.appendChild(host)
    const shadow = host.attachShadow({ mode: "open" })
    shadow.innerHTML = `
      <style>
        :host { all: initial; display: inline-block; cursor: pointer; }
        .b { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; padding: 12px 22px;
             border-radius: 14px; font: 600 16px/1.2 system-ui, -apple-system, "Segoe UI", sans-serif;
             background: ${dark ? "#f3efe6" : "#16130f"}; color: ${dark ? "#16130f" : "#f3efe6"};
             transition: transform 100ms ease-out; }
        :host(:active) .b { transform: scale(0.97); }
        .s { font-weight: 500; font-size: 12px; opacity: 0.75; }
        .s i { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #FF4F00;
               margin-right: 6px; vertical-align: 1px; }
      </style>
      <span class="b" part="button"><span></span><span class="s"><i></i>Any wallet · any chain</span></span>`
    shadow.querySelector(".b > span").textContent = label
  }

  function wire(el) {
    if (el.__tegata) return
    el.__tegata = true
    drawButton(el)
    if (!el.hasAttribute("role") && el.tagName !== "BUTTON") el.setAttribute("role", "button")
    if (!el.hasAttribute("tabindex") && el.tagName !== "BUTTON") el.tabIndex = 0
    const open = (event) => {
      event.preventDefault()
      checkout({
        link: el.getAttribute("data-tegata-link") || undefined,
        session: el.getAttribute("data-tegata-session") || undefined,
        amount: el.getAttribute("data-tegata-amount") || undefined,
        target: el,
      })
    }
    el.addEventListener("click", open)
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") open(event)
    })
  }

  const SELECTOR = "[data-tegata-link],[data-tegata-session]"
  const scan = (node) => {
    if (node.nodeType !== 1) return
    if (node.matches(SELECTOR)) wire(node)
    for (const el of node.querySelectorAll(SELECTOR)) wire(el)
  }
  const start = () => {
    scan(document.body)
    new MutationObserver((changes) => {
      for (const change of changes) for (const node of change.addedNodes) scan(node)
    }).observe(document.body, { childList: true, subtree: true })
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start)
  else start()

  window.Tegata = { checkout, close: () => close("closed") }
})()
