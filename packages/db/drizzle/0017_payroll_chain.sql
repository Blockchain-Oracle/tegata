ALTER TYPE "public"."destination_kind" ADD VALUE 'chain';--> statement-breakpoint
ALTER TABLE "pay_rows" ADD COLUMN "route" text;--> statement-breakpoint
ALTER TABLE "pay_rows" ADD COLUMN "payout_id" uuid;--> statement-breakpoint
ALTER TABLE "person_destinations" ADD COLUMN "route" text;--> statement-breakpoint
ALTER TABLE "pay_rows" ADD CONSTRAINT "pay_rows_payout_id_payouts_id_fk" FOREIGN KEY ("payout_id") REFERENCES "public"."payouts"("id") ON DELETE no action ON UPDATE no action;