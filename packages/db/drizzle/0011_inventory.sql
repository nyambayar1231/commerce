CREATE TABLE "stock" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"warehouse_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer DEFAULT 0 NOT NULL,
	"quantity_allocated" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_warehouse_id_variant_id_unique" UNIQUE("warehouse_id","variant_id"),
	CONSTRAINT "stock_quantity_not_negative" CHECK ("stock"."quantity" >= 0),
	CONSTRAINT "stock_quantity_allocated_not_negative" CHECK ("stock"."quantity_allocated" >= 0),
	CONSTRAINT "stock_quantity_allocated_not_greater_than_quantity" CHECK ("stock"."quantity_allocated" <= "stock"."quantity")
);
--> statement-breakpoint
CREATE TABLE "warehouse" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "warehouse_slug_unique" UNIQUE("slug"),
	CONSTRAINT "warehouse_name_not_empty" CHECK ("warehouse"."name" <> ''),
	CONSTRAINT "warehouse_slug_not_empty" CHECK ("warehouse"."slug" <> '')
);
--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_variant_id_idx" ON "stock" USING btree ("variant_id");--> statement-breakpoint
INSERT INTO "warehouse" ("name", "slug") VALUES ('Default Warehouse', 'default-warehouse');