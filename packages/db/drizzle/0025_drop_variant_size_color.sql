ALTER TABLE "product_variant" DROP CONSTRAINT "product_variant_size_not_empty";--> statement-breakpoint
ALTER TABLE "product_variant" DROP CONSTRAINT "product_variant_color_not_empty";--> statement-breakpoint
DROP INDEX "product_variant_product_id_size_color_unique";--> statement-breakpoint
ALTER TABLE "product_variant" DROP COLUMN "size";--> statement-breakpoint
ALTER TABLE "product_variant" DROP COLUMN "color";