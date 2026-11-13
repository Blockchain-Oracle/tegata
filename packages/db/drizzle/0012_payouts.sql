CREATE TYPE "public"."payout_kind" AS ENUM('send', 'payroll', 'refund', 'move_out');--> statement-breakpoint
CREATE TYPE "public"."payout_status" AS ENUM('drafted', 'sending', 'processing', 'delivered', 'refunded', 'failed');--> statement-breakpoint
CREATE TABLE "payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"kind" "payout_kind" NOT NULL,
	"sender_id" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"destination_asset" text NOT NULL,
	"symbol" text NOT NULL,
	"chain" text NOT NULL,
	"recipient" text NOT NULL,
	"amount_out_formatted" text,
	"quote" jsonb,
	"deposit_address" text,
	"deadline" timestamp with time zone,
	"relay_id" uuid,
	"status" "payout_status" DEFAULT 'drafted' NOT NULL,
	"swap_status" text,
	"tx_hash" text,
	"destination_tx" text,
	"error" text,
	"reference" text,
	"delivered_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payouts" ADD CONSTRAINT "payouts_relay_id_relays_id_fk" FOREIGN KEY ("relay_id") REFERENCES "public"."relays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payouts_workspace_idx" ON "payouts" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "payouts_status_idx" ON "payouts" USING btree ("status");