CREATE TABLE "studio_contract" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"origin" text NOT NULL,
	"template" jsonb,
	"contract_name" text NOT NULL,
	"source" text,
	"standard_json" text,
	"compiler_version" text,
	"abi" jsonb NOT NULL,
	"bytecode" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"network" text,
	"chain_id" integer,
	"address" text,
	"deploy_tx_hash" text,
	"deployer" text,
	"constructor_args" text,
	"deployed_at" timestamp,
	"deploy_error" text,
	"verification" text DEFAULT 'unverified' NOT NULL,
	"verification_guid" text,
	"verification_message" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "studio_contract" ADD CONSTRAINT "studio_contract_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "studio_contract" ADD CONSTRAINT "studio_contract_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "studio_contract_org_idx" ON "studio_contract" USING btree ("organization_id","created_at");