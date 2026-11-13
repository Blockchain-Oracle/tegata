CREATE TYPE "public"."pot_kind" AS ENUM('tax', 'savings');--> statement-breakpoint
CREATE TABLE "pot_moves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pot_id" uuid NOT NULL,
	"amount" numeric(78, 0) NOT NULL,
	"reason" text NOT NULL,
	"source_type" text,
	"source_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"kind" "pot_kind" NOT NULL,
	"balance" numeric(78, 0) DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "split_rules" (
	"workspace_id" uuid NOT NULL,
	"network" "network" NOT NULL,
	"on" boolean DEFAULT false NOT NULL,
	"tax_bps" integer DEFAULT 0 NOT NULL,
	"savings_bps" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "split_rules_workspace_id_network_pk" PRIMARY KEY("workspace_id","network")
);
--> statement-breakpoint
ALTER TABLE "pot_moves" ADD CONSTRAINT "pot_moves_pot_id_pots_id_fk" FOREIGN KEY ("pot_id") REFERENCES "public"."pots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pots" ADD CONSTRAINT "pots_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "split_rules" ADD CONSTRAINT "split_rules_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "pot_moves_source_idx" ON "pot_moves" USING btree ("pot_id","source_type","source_id") WHERE "pot_moves"."source_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "pots_workspace_kind_idx" ON "pots" USING btree ("workspace_id","network","kind");