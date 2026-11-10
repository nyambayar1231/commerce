CREATE TABLE "product_media" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"product_id" uuid NOT NULL,
	"image_key" text NOT NULL,
	"content_type" text NOT NULL,
	"alt" text DEFAULT '' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_media_alt_max_length" CHECK (char_length("product_media"."alt") <= 250),
	CONSTRAINT "product_media_image_key_not_empty" CHECK ("product_media"."image_key" <> '')
);
--> statement-breakpoint
CREATE TABLE "product_media_thumbnail" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"media_id" uuid NOT NULL,
	"size" integer NOT NULL,
	"format" text NOT NULL,
	"image_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_media_thumbnail_media_id_size_format_unique" UNIQUE("media_id","size","format"),
	CONSTRAINT "product_media_thumbnail_size_allowed" CHECK ("product_media_thumbnail"."size" in (32, 64, 128, 256, 512, 1024, 2048, 4096)),
	CONSTRAINT "product_media_thumbnail_format_allowed" CHECK ("product_media_thumbnail"."format" in ('ORIGINAL', 'WEBP', 'AVIF'))
);
--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media_thumbnail" ADD CONSTRAINT "product_media_thumbnail_media_id_product_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."product_media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_media_product_id_sort_order_idx" ON "product_media" USING btree ("product_id","sort_order");