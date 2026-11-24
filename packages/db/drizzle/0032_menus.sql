CREATE TABLE "menu" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "menu_slug_unique" UNIQUE("slug"),
	CONSTRAINT "menu_name_not_empty" CHECK ("menu"."name" <> ''),
	CONSTRAINT "menu_slug_not_empty" CHECK ("menu"."slug" <> '')
);
--> statement-breakpoint
CREATE TABLE "menu_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"menu_id" uuid NOT NULL,
	"parent_id" uuid,
	"name" text NOT NULL,
	"sort_order" integer NOT NULL,
	"url" text,
	"category_id" uuid,
	"collection_id" uuid,
	"page_id" uuid,
	CONSTRAINT "menu_item_name_not_empty" CHECK ("menu_item"."name" <> ''),
	CONSTRAINT "menu_item_sort_order_non_negative" CHECK ("menu_item"."sort_order" >= 0),
	CONSTRAINT "menu_item_at_most_one_target" CHECK ((("menu_item"."url" IS NOT NULL)::int + ("menu_item"."category_id" IS NOT NULL)::int + ("menu_item"."collection_id" IS NOT NULL)::int + ("menu_item"."page_id" IS NOT NULL)::int) <= 1)
);
--> statement-breakpoint
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_menu_id_menu_id_fk" FOREIGN KEY ("menu_id") REFERENCES "public"."menu"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_parent_id_menu_item_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."menu_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_collection_id_collection_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "menu_item" ADD CONSTRAINT "menu_item_page_id_page_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."page"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "menu_item_menu_parent_sort_idx" ON "menu_item" USING btree ("menu_id","parent_id","sort_order");--> statement-breakpoint
INSERT INTO "menu" ("name", "slug") VALUES ('navbar', 'navbar'), ('footer', 'footer') ON CONFLICT ("slug") DO NOTHING;