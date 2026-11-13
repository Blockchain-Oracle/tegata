CREATE TYPE "public"."person_kind" AS ENUM('employee', 'contractor');--> statement-breakpoint
ALTER TABLE "pay_rows" ADD COLUMN "kind" "person_kind" DEFAULT 'employee' NOT NULL;--> statement-breakpoint
ALTER TABLE "people" ADD COLUMN "kind" "person_kind" DEFAULT 'employee' NOT NULL;