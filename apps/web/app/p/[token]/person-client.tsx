"use client"

// The logic behind the person's page. Choosing needs a sign-in with the invited email: a signed-out person's choice
// is kept for this tab, they sign in (and, for a Tegata account, open one as themselves), and on their return the
// choice is finished here without asking again.
import { usePrivy } from "@privy-io/react-auth"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { useCallback, useEffect, useRef, useState } from "react"

import { PersonPageView } from "@/components/people/person-page-view"
import { useProfile } from "@/hooks/use-profile"
import { ApiError, api } from "@/lib/client/api"
import { rememberNext } from "@/lib/client/next-path"
import {
  clearPayrollInvite,
  loadPayrollInvite,
  type PayrollInvite,
  rememberPayrollInvite,
} from "@/lib/client/payroll-invite"
import type { PersonPage } from "@/lib/client/types"
import { fire } from "@/lib/feedback"

const POLL_MS = 3_000

export function PersonClient({ initial }: { initial: PersonPage }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { ready, authenticated } = usePrivy()
  const { profile } = useProfile()
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const finishing = useRef(false)

  const page =
    useQuery({
      queryKey: ["person-page", initial.token],
      queryFn: () => api<{ page: PersonPage }>(`/api/p/${initial.token}`),
      initialData: { page: initial },
      select: (data) => data.page,
      // Poll while their account or a NEAR registration is getting ready.
      refetchInterval: (query) =>
        query.state.data?.page.ready.state === "opening" ? POLL_MS : false,
    }).data ?? initial

  const onboarded = Boolean(profile?.user.handle)

  const submit = useCallback(
    async (choice: Pick<PayrollInvite, "choice" | "accountId" | "route">) => {
      setBusy(true)
      setProblem(null)
      try {
        const body =
          choice.choice === "near"
            ? { kind: "near", accountId: choice.accountId }
            : choice.choice === "chain"
              ? { kind: "chain", route: choice.route, address: choice.accountId }
              : { kind: "tegata" }
        const res = await api<{ page: PersonPage }>(`/api/p/${initial.token}/destination`, { body })
        clearPayrollInvite()
        queryClient.setQueryData(["person-page", initial.token], res)
        fire("confirm", { cue: "confirmed" })
      } catch (error) {
        clearPayrollInvite()
        fire("fail", { cue: "error" })
        setProblem(error instanceof ApiError ? error.message : "Couldn't save that. Try again.")
      } finally {
        setBusy(false)
      }
    },
    [initial.token, queryClient],
  )

  const start = (choice: Pick<PayrollInvite, "choice" | "accountId" | "route">) => {
    const invite = { token: initial.token, business: page.business, ...choice }
    if (!authenticated) {
      rememberPayrollInvite(invite)
      rememberNext(`/p/${initial.token}`)
      router.push("/signin")
      return
    }
    if (choice.choice === "tegata" && !onboarded) {
      rememberPayrollInvite(invite)
      rememberNext(`/p/${initial.token}`)
      router.push("/welcome")
      return
    }
    void submit(choice)
  }

  // Back from signing in (and opening an account): finish the choice they made before.
  useEffect(() => {
    if (finishing.current || !ready || !authenticated || !profile) return
    const invite = loadPayrollInvite()
    if (invite?.token !== initial.token) return
    finishing.current = true
    if (invite.choice === "tegata" && !onboarded) {
      // Signed in, no account yet: open one as themselves, then come back here.
      rememberNext(`/p/${initial.token}`)
      router.push("/welcome")
      return
    }
    void submit(invite)
  }, [ready, authenticated, profile, onboarded, initial.token, submit, router])

  return (
    <PersonPageView
      page={page}
      busy={busy}
      problem={problem}
      onTegata={() => start({ choice: "tegata" })}
      onNear={(accountId) => start({ choice: "near", accountId })}
      onChain={({ route, address }) => start({ choice: "chain", route, accountId: address })}
    />
  )
}
