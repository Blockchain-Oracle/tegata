"use client"

import { Link2, UsersRound, Wallet } from "lucide-react"
import { useMemo } from "react"

import { Button } from "@/components/kit/button"
import { EmptyState, ErrorState, LoadingShape, WaitingText } from "@/components/kit/states"

import { Section, Specimen } from "../dev-chrome"

export default function StatesPage() {
  const now = useMemo(() => Date.now(), [])
  return (
    <div className="flex flex-col">
      <Section
        title="Loading"
        note="A skeleton shaped like the real layout, shown after 120 ms and held at least 300 ms. Never a spinner page, never a made-up $0."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Specimen label="Balance">
            <LoadingShape shape="hero" />
          </Specimen>
          <Specimen label="Activity">
            <LoadingShape shape="list" />
          </Specimen>
          <Specimen label="Card">
            <LoadingShape shape="card" />
          </Specimen>
        </div>
      </Section>

      <Section
        title="Waiting"
        note="A short verb that shimmers; seconds after 3 s; 'Still waiting · Retry' at 15 s."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <Specimen label="Just started">
            <WaitingText verb="Opening your account" startedAt={now} />
          </Specimen>
          <Specimen label="After 6 s">
            <WaitingText verb="Waiting for the payment" startedAt={now - 6000} />
          </Specimen>
          <Specimen label="After 20 s">
            <WaitingText verb="Waiting on NEAR" startedAt={now - 20000} onRetry={() => undefined} />
          </Specimen>
        </div>
      </Section>

      <Section
        title="Empty"
        note="Says why and names the next action, on a colour field, never a grey void."
      >
        <div className="grid gap-4 md:grid-cols-3">
          <EmptyState
            field="sora"
            art={<Link2 />}
            title="No pay links yet"
            detail="Make one and anyone can pay you from any chain."
            action={
              <Button size="md" cue="tap">
                Create a pay link
              </Button>
            }
          />
          <EmptyState
            field="matcha"
            art={<UsersRound />}
            title="Nobody on payroll"
            detail="Add people by email or import a CSV."
            action={<Button size="md">Add people</Button>}
          />
          <EmptyState
            field="kin"
            art={<Wallet />}
            title="Your balance is $0.00"
            detail="Add test dollars to try everything in Sandbox."
            action={
              <Button size="md" variant="shu">
                Add test dollars
              </Button>
            }
          />
        </div>
      </Section>

      <Section
        title="Error"
        note="Says what still works and offers one action. Technical text sits behind a disclosure."
      >
        <div className="grid gap-4 md:grid-cols-2">
          <ErrorState
            title="Your account wasn't opened yet"
            detail="NEAR didn't answer in time."
            stillWorks="Nothing was charged. Your sign-in is kept."
            onRetry={() => undefined}
            technical="RPC timeout after 15000 ms (test.rpc.fastnear.com)"
          />
          <ErrorState
            title="That payment didn't go through"
            detail="The route to Tron closed before the deposit arrived."
            stillWorks="No money moved. The payer can try another coin."
            onRetry={() => undefined}
          />
        </div>
      </Section>
    </div>
  )
}
