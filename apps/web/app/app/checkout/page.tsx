"use client"

// Checkout: the data behind CheckoutView. `?link=<id>` opens it with that pay link chosen (from a link's page).
import { useQuery } from "@tanstack/react-query"
import { useSearchParams } from "next/navigation"
import { Suspense, useEffect, useState } from "react"

import { CheckoutView } from "@/components/checkout/checkout-view"
import { useNetwork } from "@/hooks/use-network"
import { api } from "@/lib/client/api"
import type { PayLink } from "@/lib/client/types"

export default function CheckoutPage() {
  return (
    <Suspense>
      <Checkout />
    </Suspense>
  )
}

function Checkout() {
  const params = useSearchParams()
  const network = useNetwork()
  const [origin, setOrigin] = useState("https://tegata.xyz")
  useEffect(() => setOrigin(window.location.origin), [])
  const links = useQuery({
    queryKey: ["links"],
    queryFn: () => api<{ links: PayLink[] }>("/api/links"),
    select: (data) => data.links.filter((link) => link.network === network),
  })
  return (
    <CheckoutView
      links={links.data}
      error={links.isError}
      onRetry={() => void links.refetch()}
      origin={origin}
      sandbox={network === "testnet"}
      initialLink={params.get("link")}
    />
  )
}
