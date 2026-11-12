CREATE TYPE "public"."payment_rail" AS ENUM('tegata', 'near_wallet', 'oneclick');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('awaiting', 'detected', 'settling', 'succeeded', 'refunded', 'failed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."request_kind" AS ENUM('link', 'invoice', 'session');--> statement-breakpoint
CREATE TYPE "public"."request_status" AS ENUM('open', 'paid', 'closed');--> statement-breakpoint
CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"rail" "payment_rail" NOT NULL,
	"status" "payment_status" DEFAULT 'awaiting' NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"memo" text NOT NULL,
	"receiver_id" text NOT NULL,
	"payer" text,
	"payer_email" text,
	"tx_hash" text,
	"relay_id" uuid,
	"quote" jsonb,
	"deposit_address" text,
	"deadline" timestamp with time zone,
	"error" text,
	"settled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	"token" text NOT NULL,
	"number" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"kind" "request_kind" NOT NULL,
	"token" text NOT NULL,
	"title" text NOT NULL,
	"note" text,
	"amount" numeric(78, 0),
	"reusable" boolean DEFAULT true NOT NULL,
	"status" "request_status" DEFAULT 'open' NOT NULL,
	"receiver_id" text NOT NULL,
	"paid_count" integer DEFAULT 0 NOT NULL,
	"paid_total" numeric(78, 0) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_request_id_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."requests"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_relay_id_relays_id_fk" FOREIGN KEY ("relay_id") REFERENCES "public"."relays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requests" ADD CONSTRAINT "requests_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_request_idx" ON "payments" USING btree ("request_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_status_idx" ON "payments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "payments_tx_idx" ON "payments" USING btree ("network","tx_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_payment_idx" ON "receipts" USING btree ("payment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_token_idx" ON "receipts" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "receipts_number_idx" ON "receipts" USING btree ("workspace_id","number");--> statement-breakpoint
CREATE UNIQUE INDEX "requests_token_idx" ON "requests" USING btree ("token");--> statement-breakpoint
CREATE INDEX "requests_workspace_idx" ON "requests" USING btree ("workspace_id","created_at");