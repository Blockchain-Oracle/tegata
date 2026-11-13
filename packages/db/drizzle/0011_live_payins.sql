ALTER TABLE "payments" ADD COLUMN "refund_to" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "asset_in" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "amount_in" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "swap_status" text;--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "origin_tx" text;