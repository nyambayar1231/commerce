CREATE TABLE "variant_media" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"variant_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	CONSTRAINT "variant_media_variant_id_media_id_unique" UNIQUE("variant_id","media_id")
);
--> statement-breakpoint
ALTER TABLE "variant_media" ADD CONSTRAINT "variant_media_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variant_media" ADD CONSTRAINT "variant_media_media_id_product_media_id_fk" FOREIGN KEY ("media_id") REFERENCES "public"."product_media"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "variant_media_media_id_idx" ON "variant_media" USING btree ("media_id");