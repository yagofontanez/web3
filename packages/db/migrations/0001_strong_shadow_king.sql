CREATE TABLE "saved_address" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"address" text NOT NULL,
	"label" text NOT NULL,
	"ens_name" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "saved_address" ADD CONSTRAINT "saved_address_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_address" ADD CONSTRAINT "saved_address_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "saved_address_org_address_uq" ON "saved_address" USING btree ("organization_id","address");--> statement-breakpoint
CREATE INDEX "saved_address_org_created_idx" ON "saved_address" USING btree ("organization_id","created_at");