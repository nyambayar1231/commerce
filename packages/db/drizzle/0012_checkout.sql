CREATE TABLE "checkout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"email" text,
	"shipping_address" jsonb,
	"billing_address" jsonb,
	"shipping_method_id" uuid,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_order_id" uuid
);
--> statement-breakpoint
CREATE TABLE "checkout_line" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"checkout_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checkout_line_checkout_id_variant_id_unique" UNIQUE("checkout_id","variant_id"),
	CONSTRAINT "checkout_line_quantity_positive" CHECK ("checkout_line"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_line" ADD CONSTRAINT "checkout_line_checkout_id_checkout_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkout"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "checkout_line" ADD CONSTRAINT "checkout_line_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "checkout_line_variant_id_idx" ON "checkout_line" USING btree ("variant_id");