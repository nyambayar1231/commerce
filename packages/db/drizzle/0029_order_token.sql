ALTER TABLE "order" ADD COLUMN "token" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_token_unique" UNIQUE("token");