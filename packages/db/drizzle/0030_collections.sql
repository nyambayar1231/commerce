CREATE TABLE "collection" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" jsonb,
	"description_plaintext" text DEFAULT '' NOT NULL,
	"is_published" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_slug_unique" UNIQUE("slug"),
	CONSTRAINT "collection_name_not_empty" CHECK ("collection"."name" <> ''),
	CONSTRAINT "collection_slug_not_empty" CHECK ("collection"."slug" <> '')
);
--> statement-breakpoint
CREATE TABLE "collection_product" (
	"collection_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_product_collection_id_product_id_pk" PRIMARY KEY("collection_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "collection_product" ADD CONSTRAINT "collection_product_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collection_product" ADD CONSTRAINT "collection_product_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_product_product_id_idx" ON "collection_product" USING btree ("product_id");