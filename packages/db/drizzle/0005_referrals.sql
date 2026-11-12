CREATE TYPE "public"."referral_payout_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."referral_side" AS ENUM('referrer', 'referee');--> statement-breakpoint
CREATE TYPE "public"."referral_status" AS ENUM('open', 'qualified', 'paid', 'void');--> statement-breakpoint
CREATE TABLE "referral_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"referral_id" uuid NOT NULL,
	"side" "referral_side" NOT NULL,
	"account_id" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"status" "referral_payout_status" DEFAULT 'queued' NOT NULL,
	"tx_hash" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referrals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"network" "network" NOT NULL,
	"referrer_id" uuid NOT NULL,
	"referee_id" uuid NOT NULL,
	"referrer_account" text NOT NULL,
	"referee_account" text NOT NULL,
	"status" "referral_status" DEFAULT 'open' NOT NULL,
	"received" numeric(78, 0) NOT NULL,
	"qualifying_payers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"locked_at" timestamp with time zone,
	"qualified_at" timestamp with time zone,
	"payout_after" timestamp with time zone,
	"paid_at" timestamp with time zone,
	"void_reason" text,
	"flag" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "referral_payouts" ADD CONSTRAINT "referral_payouts_referral_id_referrals_id_fk" FOREIGN KEY ("referral_id") REFERENCES "public"."referrals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referrer_id_users_id_fk" FOREIGN KEY ("referrer_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referrals" ADD CONSTRAINT "referrals_referee_id_users_id_fk" FOREIGN KEY ("referee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "referral_payouts_side_idx" ON "referral_payouts" USING btree ("referral_id","side");--> statement-breakpoint
CREATE UNIQUE INDEX "referrals_referee_idx" ON "referrals" USING btree ("referee_id","network");--> statement-breakpoint
CREATE INDEX "referrals_referrer_idx" ON "referrals" USING btree ("referrer_id","created_at");--> statement-breakpoint
CREATE INDEX "referrals_status_idx" ON "referrals" USING btree ("status");