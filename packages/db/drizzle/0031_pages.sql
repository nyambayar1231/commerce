ALTER TYPE "public"."permission" ADD VALUE 'MANAGE_PAGES';--> statement-breakpoint
ALTER TYPE "public"."permission" ADD VALUE 'MANAGE_MENUS';--> statement-breakpoint
CREATE TABLE "page" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"title" text NOT NULL,
	"slug" text NOT NULL,
	"content" jsonb,
	"content_plaintext" text DEFAULT '' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "page_slug_unique" UNIQUE("slug"),
	CONSTRAINT "page_title_not_empty" CHECK ("page"."title" <> ''),
	CONSTRAINT "page_slug_not_empty" CHECK ("page"."slug" <> '')
);
