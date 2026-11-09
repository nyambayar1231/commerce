CREATE TABLE "product" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"category_id" uuid,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" jsonb,
	"description_plaintext" text DEFAULT '' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_slug_unique" UNIQUE("slug"),
	CONSTRAINT "product_name_not_empty" CHECK ("product"."name" <> ''),
	CONSTRAINT "product_slug_not_empty" CHECK ("product"."slug" <> '')
);
--> statement-breakpoint
CREATE TABLE "product_variant" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" text,
	"name" text DEFAULT '' NOT NULL,
	"price_amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"track_inventory" boolean DEFAULT true NOT NULL,
	"weight_grams" integer,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_variant_sku_unique" UNIQUE("sku"),
	CONSTRAINT "product_variant_sku_not_empty" CHECK ("product_variant"."sku" IS NULL OR "product_variant"."sku" <> ''),
	CONSTRAINT "product_variant_price_not_negative" CHECK ("product_variant"."price_amount" >= 0),
	CONSTRAINT "product_variant_currency_not_empty" CHECK ("product_variant"."currency" <> ''),
	CONSTRAINT "product_variant_weight_not_negative" CHECK ("product_variant"."weight_grams" IS NULL OR "product_variant"."weight_grams" >= 0)
);
--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_category_id_idx" ON "product" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "product_variant_product_id_idx" ON "product_variant" USING btree ("product_id");