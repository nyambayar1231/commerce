CREATE TABLE "rate_limit" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "rate_limit_count_not_negative" CHECK ("rate_limit"."count" >= 0)
);
--> statement-breakpoint
CREATE INDEX "rate_limit_expires_at_idx" ON "rate_limit" USING btree ("expires_at");