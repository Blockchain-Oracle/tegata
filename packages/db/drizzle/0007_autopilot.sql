CREATE TYPE "public"."autopilot_status" AS ENUM('preparing', 'ready', 'approved', 'on', 'off', 'failed');--> statement-breakpoint
CREATE TYPE "public"."pay_run_source" AS ENUM('approval', 'autopilot');--> statement-breakpoint
CREATE TABLE "autopilot_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"status" "autopilot_status" DEFAULT 'preparing' NOT NULL,
	"plan_id" text,
	"sender_id" text NOT NULL,
	"paydays" jsonb NOT NULL,
	"due_ms" jsonb NOT NULL,
	"rows" jsonb NOT NULL,
	"total" numeric(78, 0) NOT NULL,
	"set_aside" numeric(78, 0) NOT NULL,
	"register_tx" text,
	"deposit_relay_id" uuid,
	"plan_relay_id" uuid,
	"underfunded" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pay_runs" ADD COLUMN "source" "pay_run_source" DEFAULT 'approval' NOT NULL;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD COLUMN "autopilot_id" uuid;--> statement-breakpoint
ALTER TABLE "autopilot_plans" ADD CONSTRAINT "autopilot_plans_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_plans" ADD CONSTRAINT "autopilot_plans_deposit_relay_id_relays_id_fk" FOREIGN KEY ("deposit_relay_id") REFERENCES "public"."relays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "autopilot_plans" ADD CONSTRAINT "autopilot_plans_plan_relay_id_relays_id_fk" FOREIGN KEY ("plan_relay_id") REFERENCES "public"."relays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "autopilot_plans_workspace_idx" ON "autopilot_plans" USING btree ("workspace_id","network","created_at");--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_autopilot_id_autopilot_plans_id_fk" FOREIGN KEY ("autopilot_id") REFERENCES "public"."autopilot_plans"("id") ON DELETE no action ON UPDATE no action;