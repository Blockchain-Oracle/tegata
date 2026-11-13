ALTER TYPE "public"."payment_rail" ADD VALUE 'card';--> statement-breakpoint
ALTER TABLE "payments" ADD COLUMN "card_order_id" text;