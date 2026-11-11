CREATE TABLE "allocation" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_line_id" uuid NOT NULL,
	"stock_id" uuid NOT NULL,
	"quantity_allocated" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allocation_order_line_id_stock_id_unique" UNIQUE("order_line_id","stock_id"),
	CONSTRAINT "allocation_quantity_positive" CHECK ("allocation"."quantity_allocated" > 0)
);
--> statement-breakpoint
CREATE TABLE "order" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"number" bigint GENERATED ALWAYS AS IDENTITY (sequence name "order_number_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"status" text NOT NULL,
	"user_id" uuid,
	"user_email" text NOT NULL,
	"billing_address" jsonb NOT NULL,
	"shipping_address" jsonb NOT NULL,
	"shipping_method_name" text NOT NULL,
	"shipping_price_amount" bigint NOT NULL,
	"subtotal_amount" bigint NOT NULL,
	"total_amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"checkout_token" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_number_unique" UNIQUE("number"),
	CONSTRAINT "order_checkout_token_unique" UNIQUE("checkout_token"),
	CONSTRAINT "order_status_known" CHECK ("status" IN ('UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELED')),
	CONSTRAINT "order_shipping_price_not_negative" CHECK ("order"."shipping_price_amount" >= 0),
	CONSTRAINT "order_subtotal_not_negative" CHECK ("order"."subtotal_amount" >= 0),
	CONSTRAINT "order_total_is_subtotal_plus_shipping" CHECK ("order"."total_amount" = "order"."subtotal_amount" + "order"."shipping_price_amount")
);
--> statement-breakpoint
CREATE TABLE "order_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_id" uuid NOT NULL,
	"type" text NOT NULL,
	"user_id" uuid,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_event_type_known" CHECK ("type" IN ('PLACED'))
);
--> statement-breakpoint
CREATE TABLE "order_line" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid,
	"product_name" text NOT NULL,
	"variant_name" text NOT NULL,
	"product_sku" text,
	"quantity" integer NOT NULL,
	"quantity_fulfilled" integer DEFAULT 0 NOT NULL,
	"unit_price_amount" bigint NOT NULL,
	"total_price_amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_line_quantity_positive" CHECK ("order_line"."quantity" > 0),
	CONSTRAINT "order_line_quantity_fulfilled_in_range" CHECK ("order_line"."quantity_fulfilled" >= 0 AND "order_line"."quantity_fulfilled" <= "order_line"."quantity"),
	CONSTRAINT "order_line_unit_price_not_negative" CHECK ("order_line"."unit_price_amount" >= 0),
	CONSTRAINT "order_line_total_is_unit_times_quantity" CHECK ("order_line"."total_price_amount" = "order_line"."unit_price_amount" * "order_line"."quantity")
);
--> statement-breakpoint
ALTER TABLE "shipping_method" ALTER COLUMN "price_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "payment_event" ALTER COLUMN "amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "payment_transaction" ALTER COLUMN "authorized_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "payment_transaction" ALTER COLUMN "charged_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "payment_transaction" ALTER COLUMN "refunded_amount" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "allocation" ADD CONSTRAINT "allocation_order_line_id_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "allocation" ADD CONSTRAINT "allocation_stock_id_stock_id_fk" FOREIGN KEY ("stock_id") REFERENCES "public"."stock"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_line" ADD CONSTRAINT "order_line_variant_id_product_variant_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."product_variant"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "allocation_stock_id_idx" ON "allocation" USING btree ("stock_id");--> statement-breakpoint
CREATE INDEX "order_user_id_idx" ON "order" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "order_event_order_id_idx" ON "order_event" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_line_order_id_idx" ON "order_line" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_line_variant_id_idx" ON "order_line" USING btree ("variant_id");--> statement-breakpoint
ALTER TABLE "checkout" ADD CONSTRAINT "checkout_completed_order_id_order_id_fk" FOREIGN KEY ("completed_order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transaction" ADD CONSTRAINT "payment_transaction_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;