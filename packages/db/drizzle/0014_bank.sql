CREATE TYPE "public"."bank_payout_status" AS ENUM('drafted', 'sending', 'converting', 'paying', 'paid', 'failed');--> statement-breakpoint
CREATE TABLE "bank_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"fiat" text NOT NULL,
	"virtual_account_id" text NOT NULL,
	"payment_method_id" text NOT NULL,
	"details" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"noah_customer_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_deposits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"noah_tx_id" text NOT NULL,
	"workspace_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"fiat_amount" text NOT NULL,
	"fiat" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"credit_tx" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_payout_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"country" text NOT NULL,
	"fiat" text NOT NULL,
	"label" text NOT NULL,
	"form" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"payout_account_id" uuid NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"fiat" text NOT NULL,
	"fiat_amount" text NOT NULL,
	"rate" text NOT NULL,
	"fee" text NOT NULL,
	"channel_id" text NOT NULL,
	"form_session_id" text,
	"rule_id" text,
	"deposit_address" text,
	"relay_id" uuid,
	"near_tx" text,
	"hop_tx" text,
	"noah_tx_id" text,
	"status" "bank_payout_status" DEFAULT 'drafted' NOT NULL,
	"error" text,
	"paid_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_customers" ADD CONSTRAINT "bank_customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_deposits" ADD CONSTRAINT "bank_deposits_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_payout_accounts" ADD CONSTRAINT "bank_payout_accounts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_payouts" ADD CONSTRAINT "bank_payouts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_payouts" ADD CONSTRAINT "bank_payouts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_payouts" ADD CONSTRAINT "bank_payouts_payout_account_id_bank_payout_accounts_id_fk" FOREIGN KEY ("payout_account_id") REFERENCES "public"."bank_payout_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_payouts" ADD CONSTRAINT "bank_payouts_relay_id_relays_id_fk" FOREIGN KEY ("relay_id") REFERENCES "public"."relays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_accounts_workspace_idx" ON "bank_accounts" USING btree ("workspace_id","network","fiat");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_customers_user_idx" ON "bank_customers" USING btree ("user_id","network");--> statement-breakpoint
CREATE UNIQUE INDEX "bank_deposits_noah_idx" ON "bank_deposits" USING btree ("noah_tx_id");--> statement-breakpoint
CREATE INDEX "bank_payout_accounts_workspace_idx" ON "bank_payout_accounts" USING btree ("workspace_id","network");--> statement-breakpoint
CREATE INDEX "bank_payouts_workspace_idx" ON "bank_payouts" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "bank_payouts_status_idx" ON "bank_payouts" USING btree ("status");