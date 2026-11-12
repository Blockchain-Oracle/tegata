CREATE TYPE "public"."destination_kind" AS ENUM('tegata', 'near');--> statement-breakpoint
CREATE TYPE "public"."destination_set_by" AS ENUM('person', 'owner');--> statement-breakpoint
CREATE TYPE "public"."pay_cadence" AS ENUM('weekly', 'fortnightly', 'monthly');--> statement-breakpoint
CREATE TYPE "public"."pay_row_status" AS ENUM('included', 'excluded', 'skipped', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."pay_run_status" AS ENUM('draft', 'approved', 'paid', 'failed');--> statement-breakpoint
CREATE TYPE "public"."person_status" AS ENUM('active', 'removed');--> statement-breakpoint
CREATE TABLE "pay_rows" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"destination_kind" "destination_kind",
	"account_id" text,
	"amount" numeric(78, 0) NOT NULL,
	"status" "pay_row_status" NOT NULL,
	"skip_reason" text,
	"batch" integer,
	"relay_id" uuid,
	"tx_hash" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pay_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"payday" date NOT NULL,
	"period_from" date NOT NULL,
	"period_to" date NOT NULL,
	"status" "pay_run_status" DEFAULT 'draft' NOT NULL,
	"sender_id" text NOT NULL,
	"total" numeric(78, 0) DEFAULT 0 NOT NULL,
	"attempt" integer DEFAULT 1 NOT NULL,
	"tx_hashes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"error" text,
	"approved_at" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payrolls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"cadence" "pay_cadence" NOT NULL,
	"first_payday" date NOT NULL,
	"anchor_day" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"role" text,
	"amount" numeric(78, 0) NOT NULL,
	"token" text NOT NULL,
	"user_id" uuid,
	"status" "person_status" DEFAULT 'active' NOT NULL,
	"invited_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "person_destinations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"person_id" uuid NOT NULL,
	"kind" "destination_kind" NOT NULL,
	"account_id" text,
	"set_by" "destination_set_by" NOT NULL,
	"activates_at" timestamp with time zone NOT NULL,
	"ready_at" timestamp with time zone,
	"registered_tx" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pay_rows" ADD CONSTRAINT "pay_rows_run_id_pay_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pay_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_rows" ADD CONSTRAINT "pay_rows_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_rows" ADD CONSTRAINT "pay_rows_relay_id_relays_id_fk" FOREIGN KEY ("relay_id") REFERENCES "public"."relays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD CONSTRAINT "pay_runs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payrolls" ADD CONSTRAINT "payrolls_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "person_destinations" ADD CONSTRAINT "person_destinations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pay_rows_person_idx" ON "pay_rows" USING btree ("run_id","person_id");--> statement-breakpoint
CREATE INDEX "pay_rows_relay_idx" ON "pay_rows" USING btree ("relay_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pay_runs_payday_idx" ON "pay_runs" USING btree ("workspace_id","network","payday");--> statement-breakpoint
CREATE INDEX "pay_runs_workspace_idx" ON "pay_runs" USING btree ("workspace_id","network","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "payrolls_workspace_idx" ON "payrolls" USING btree ("workspace_id","network");--> statement-breakpoint
CREATE UNIQUE INDEX "people_token_idx" ON "people" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "people_email_idx" ON "people" USING btree ("workspace_id","network","email");--> statement-breakpoint
CREATE INDEX "people_workspace_idx" ON "people" USING btree ("workspace_id","network","status");--> statement-breakpoint
CREATE INDEX "people_user_idx" ON "people" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "person_destinations_person_idx" ON "person_destinations" USING btree ("person_id","created_at");