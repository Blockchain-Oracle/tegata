ALTER TABLE "pay_rows" ADD COLUMN "base_pay" numeric(78, 0);--> statement-breakpoint
ALTER TABLE "pay_rows" ADD COLUMN "lines" jsonb DEFAULT '[]'::jsonb NOT NULL;