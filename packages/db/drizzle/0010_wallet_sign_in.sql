CREATE TABLE "sign_in_challenges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nonce" text NOT NULL,
	"network" "network" NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sign_in_challenges_nonce_unique" UNIQUE("nonce")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "wallet_network" "network";--> statement-breakpoint
CREATE UNIQUE INDEX "users_wallet_account_idx" ON "users" USING btree ("wallet_account_id");