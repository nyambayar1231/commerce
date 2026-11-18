ALTER TABLE "product_variant" ADD COLUMN "size" text;--> statement-breakpoint
ALTER TABLE "product_variant" ADD COLUMN "color" text;--> statement-breakpoint
CREATE UNIQUE INDEX "product_variant_product_id_size_color_unique" ON "product_variant" USING btree ("product_id",coalesce("size", ''),coalesce("color", '')) WHERE "product_variant"."size" IS NOT NULL OR "product_variant"."color" IS NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_size_not_empty" CHECK ("product_variant"."size" IS NULL OR "product_variant"."size" <> '');--> statement-breakpoint
ALTER TABLE "product_variant" ADD CONSTRAINT "product_variant_color_not_empty" CHECK ("product_variant"."color" IS NULL OR "product_variant"."color" <> '');