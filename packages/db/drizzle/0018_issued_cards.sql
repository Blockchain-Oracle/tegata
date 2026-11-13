CREATE TYPE "public"."card_move_direction" AS ENUM('in', 'out');--> statement-breakpoint
CREATE TYPE "public"."card_move_status" AS ENUM('drafted', 'sent', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."issued_card_status" AS ENUM('making', 'active', 'frozen', 'removed', 'failed');--> statement-breakpoint
CREATE TABLE "card_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"direction" "card_move_direction" NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"status" "card_move_status" DEFAULT 'drafted' NOT NULL,
	"relay_id" uuid,
	"tx_hash" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "card_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"kind" text NOT NULL,
	"merchant" text,
	"amount" numeric(78, 0),
	"reason" text,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "issued_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"provider" text DEFAULT 'bitnob' NOT NULL,
	"provider_card_id" text,
	"provider_customer_id" text,
	"person_id" uuid,
	"holder_name" text NOT NULL,
	"nickname" text NOT NULL,
	"tone" text NOT NULL,
	"last4" text,
	"status" "issued_card_status" DEFAULT 'making' NOT NULL,
	"frozen_by" text,
	"monthly_limit" numeric(78, 0),
	"on_card" numeric(78, 0) DEFAULT 0 NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "card_moves" ADD CONSTRAINT "card_moves_card_id_issued_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."issued_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_moves" ADD CONSTRAINT "card_moves_relay_id_relays_id_fk" FOREIGN KEY ("relay_id") REFERENCES "public"."relays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_purchases" ADD CONSTRAINT "card_purchases_card_id_issued_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."issued_cards"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_cards" ADD CONSTRAINT "issued_cards_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "issued_cards" ADD CONSTRAINT "issued_cards_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "card_moves_card_idx" ON "card_moves" USING btree ("card_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "card_purchases_event_idx" ON "card_purchases" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "card_purchases_card_idx" ON "card_purchases" USING btree ("card_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "issued_cards_provider_idx" ON "issued_cards" USING btree ("provider","provider_card_id");--> statement-breakpoint
CREATE INDEX "issued_cards_workspace_idx" ON "issued_cards" USING btree ("workspace_id","network","created_at");