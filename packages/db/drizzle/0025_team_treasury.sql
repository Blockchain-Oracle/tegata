CREATE TYPE "public"."team_member_status" AS ENUM('invited', 'active', 'removed');--> statement-breakpoint
CREATE TYPE "public"."treasury_status" AS ENUM('creating', 'sealing', 'ready', 'failed');--> statement-breakpoint
ALTER TYPE "public"."pay_run_source" ADD VALUE 'treasury';--> statement-breakpoint
ALTER TYPE "public"."pay_run_status" ADD VALUE 'proposed';--> statement-breakpoint
ALTER TYPE "public"."pay_run_status" ADD VALUE 'declined';--> statement-breakpoint
ALTER TYPE "public"."pay_run_status" ADD VALUE 'expired';--> statement-breakpoint
CREATE TABLE "run_votes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"user_id" uuid,
	"account_id" text NOT NULL,
	"vote" text NOT NULL,
	"relay_id" uuid,
	"tx_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "team_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"token" text NOT NULL,
	"user_id" uuid,
	"account_id" text,
	"status" "team_member_status" DEFAULT 'invited' NOT NULL,
	"invited_at" timestamp with time zone,
	"joined_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "treasuries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"account_id" text NOT NULL,
	"threshold" integer NOT NULL,
	"approvers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" "treasury_status" DEFAULT 'creating' NOT NULL,
	"create_tx" text,
	"seal_relay_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pay_runs" ADD COLUMN "treasury_id" uuid;--> statement-breakpoint
ALTER TABLE "pay_runs" ADD COLUMN "proposal_id" integer;--> statement-breakpoint
ALTER TABLE "run_votes" ADD CONSTRAINT "run_votes_run_id_pay_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pay_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_votes" ADD CONSTRAINT "run_votes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_votes" ADD CONSTRAINT "run_votes_relay_id_relays_id_fk" FOREIGN KEY ("relay_id") REFERENCES "public"."relays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasuries" ADD CONSTRAINT "treasuries_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "treasuries" ADD CONSTRAINT "treasuries_seal_relay_id_relays_id_fk" FOREIGN KEY ("seal_relay_id") REFERENCES "public"."relays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "run_votes_voter_idx" ON "run_votes" USING btree ("run_id","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_token_idx" ON "team_members" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "team_members_email_idx" ON "team_members" USING btree ("workspace_id","network","email");--> statement-breakpoint
CREATE INDEX "team_members_user_idx" ON "team_members" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "treasuries_workspace_idx" ON "treasuries" USING btree ("workspace_id","network");--> statement-breakpoint
CREATE UNIQUE INDEX "treasuries_account_idx" ON "treasuries" USING btree ("account_id");