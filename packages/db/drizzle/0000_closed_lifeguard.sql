CREATE TYPE "public"."network" AS ENUM('mainnet', 'testnet');--> statement-breakpoint
CREATE TYPE "public"."relay_status" AS ENUM('drafted', 'signed', 'sent', 'success', 'failed', 'unknown', 'expired');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"account_id" text NOT NULL,
	"created_tx" text,
	"registered_tx" text,
	"ready_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"purpose" text NOT NULL,
	"sender_id" text NOT NULL,
	"receiver_id" text NOT NULL,
	"draft" jsonb NOT NULL,
	"signature" text,
	"status" "relay_status" DEFAULT 'drafted' NOT NULL,
	"tx_hash" text,
	"error" text,
	"tokens_burnt" numeric(78, 0),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"privy_id" text,
	"email" text,
	"handle" text,
	"public_key" text,
	"wallet_account_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_privyId_unique" UNIQUE("privy_id"),
	CONSTRAINT "users_handle_unique" UNIQUE("handle")
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"name" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"logo_url" text,
	"address" text,
	"tax_id" text,
	"email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relays" ADD CONSTRAINT "relays_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_user_network_idx" ON "accounts" USING btree ("user_id","network");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_network_account_idx" ON "accounts" USING btree ("network","account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "relays_purpose_idx" ON "relays" USING btree ("purpose");--> statement-breakpoint
CREATE INDEX "relays_user_created_idx" ON "relays" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "relays_status_idx" ON "relays" USING btree ("status");--> statement-breakpoint
CREATE INDEX "users_email_idx" ON "users" USING btree ("email");