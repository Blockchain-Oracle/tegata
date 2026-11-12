CREATE TYPE "public"."test_dollar_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TABLE "test_dollars" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"day" text NOT NULL,
	"status" "test_dollar_status" DEFAULT 'queued' NOT NULL,
	"tx_hash" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "test_dollars" ADD CONSTRAINT "test_dollars_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "test_dollars_day_idx" ON "test_dollars" USING btree ("user_id","day");--> statement-breakpoint
CREATE INDEX "test_dollars_status_idx" ON "test_dollars" USING btree ("status");