CREATE TABLE "shipping_method" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"price_amount" integer NOT NULL,
	"currency" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipping_method_name_not_empty" CHECK ("shipping_method"."name" <> ''),
	CONSTRAINT "shipping_method_price_not_negative" CHECK ("shipping_method"."price_amount" >= 0)
);
--> statement-breakpoint
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_shipping_method_id_shipping_method_id_fk" FOREIGN KEY ("shipping_method_id") REFERENCES "public"."shipping_method"("id") ON DELETE set null ON UPDATE no action;