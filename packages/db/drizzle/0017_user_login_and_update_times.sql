ALTER TABLE "user" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "last_login" timestamp with time zone;--> statement-breakpoint
-- Existing users were last modified when they were created, not when this migration ran.
UPDATE "user" SET "updated_at" = "created_at";
