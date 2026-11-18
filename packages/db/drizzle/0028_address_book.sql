CREATE TABLE "address" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"first_name" text DEFAULT '' NOT NULL,
	"last_name" text DEFAULT '' NOT NULL,
	"company_name" text DEFAULT '' NOT NULL,
	"street_address_1" text DEFAULT '' NOT NULL,
	"street_address_2" text DEFAULT '' NOT NULL,
	"city" text DEFAULT '' NOT NULL,
	"city_area" text DEFAULT '' NOT NULL,
	"postal_code" text DEFAULT '' NOT NULL,
	"country" text NOT NULL,
	"country_area" text DEFAULT '' NOT NULL,
	"phone" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "default_shipping_address_id" uuid;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "default_billing_address_id" uuid;--> statement-breakpoint
ALTER TABLE "address" ADD CONSTRAINT "address_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "address_user_id_idx" ON "address" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_default_shipping_address_id_address_id_fk" FOREIGN KEY ("default_shipping_address_id") REFERENCES "public"."address"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user" ADD CONSTRAINT "user_default_billing_address_id_address_id_fk" FOREIGN KEY ("default_billing_address_id") REFERENCES "public"."address"("id") ON DELETE set null ON UPDATE no action;