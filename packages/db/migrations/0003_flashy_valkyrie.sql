CREATE TABLE "alert" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"monitor_id" text NOT NULL,
	"dedupe_key" text NOT NULL,
	"title" text NOT NULL,
	"payload" jsonb NOT NULL,
	"test" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery" (
	"id" text PRIMARY KEY NOT NULL,
	"alert_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_status_code" smallint,
	"last_error" text,
	"last_attempt_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"kind" text NOT NULL,
	"network" text NOT NULL,
	"address" text NOT NULL,
	"params" jsonb NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_checked_block" bigint,
	"last_triggered_at" timestamp,
	"last_error" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "monitor_channel" (
	"monitor_id" text NOT NULL,
	"channel_id" text NOT NULL,
	CONSTRAINT "monitor_channel_monitor_id_channel_id_pk" PRIMARY KEY("monitor_id","channel_id")
);
--> statement-breakpoint
CREATE TABLE "notification_channel" (
	"id" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"config" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"disabled_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "telegram_link" (
	"code" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"channel_id" text
);
--> statement-breakpoint
ALTER TABLE "alert" ADD CONSTRAINT "alert_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alert" ADD CONSTRAINT "alert_monitor_id_monitor_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_alert_id_alert_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."alert"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery" ADD CONSTRAINT "delivery_channel_id_notification_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor" ADD CONSTRAINT "monitor_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor" ADD CONSTRAINT "monitor_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_channel" ADD CONSTRAINT "monitor_channel_monitor_id_monitor_id_fk" FOREIGN KEY ("monitor_id") REFERENCES "public"."monitor"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "monitor_channel" ADD CONSTRAINT "monitor_channel_channel_id_notification_channel_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."notification_channel"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channel" ADD CONSTRAINT "notification_channel_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_channel" ADD CONSTRAINT "notification_channel_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_link" ADD CONSTRAINT "telegram_link_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_link" ADD CONSTRAINT "telegram_link_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "alert_monitor_dedupe_uq" ON "alert" USING btree ("monitor_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "alert_org_created_idx" ON "alert" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "delivery_alert_channel_uq" ON "delivery" USING btree ("alert_id","channel_id");--> statement-breakpoint
CREATE INDEX "delivery_status_idx" ON "delivery" USING btree ("status");--> statement-breakpoint
CREATE INDEX "monitor_org_idx" ON "monitor" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "monitor_enabled_network_idx" ON "monitor" USING btree ("enabled","network");--> statement-breakpoint
CREATE INDEX "notification_channel_org_idx" ON "notification_channel" USING btree ("organization_id");