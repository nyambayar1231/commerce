ALTER TYPE "public"."permission" ADD VALUE 'HANDLE_PAYMENTS';--> statement-breakpoint
CREATE TABLE "fulfillment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"order_id" uuid NOT NULL,
	"fulfillment_order" integer NOT NULL,
	"status" text NOT NULL,
	"warehouse_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fulfillment_order_id_fulfillment_order_unique" UNIQUE("order_id","fulfillment_order"),
	CONSTRAINT "fulfillment_status_known" CHECK ("status" IN ('FULFILLED')),
	CONSTRAINT "fulfillment_order_positive" CHECK ("fulfillment"."fulfillment_order" > 0)
);
--> statement-breakpoint
CREATE TABLE "fulfillment_line" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"fulfillment_id" uuid NOT NULL,
	"order_line_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	CONSTRAINT "fulfillment_line_quantity_positive" CHECK ("fulfillment_line"."quantity" > 0)
);
--> statement-breakpoint
ALTER TABLE "order_event" DROP CONSTRAINT "order_event_type_known";--> statement-breakpoint
ALTER TABLE "payment_event" DROP CONSTRAINT "payment_event_type_known";--> statement-breakpoint
ALTER TABLE "fulfillment" ADD CONSTRAINT "fulfillment_order_id_order_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."order"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment" ADD CONSTRAINT "fulfillment_warehouse_id_warehouse_id_fk" FOREIGN KEY ("warehouse_id") REFERENCES "public"."warehouse"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_line" ADD CONSTRAINT "fulfillment_line_fulfillment_id_fulfillment_id_fk" FOREIGN KEY ("fulfillment_id") REFERENCES "public"."fulfillment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fulfillment_line" ADD CONSTRAINT "fulfillment_line_order_line_id_order_line_id_fk" FOREIGN KEY ("order_line_id") REFERENCES "public"."order_line"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fulfillment_line_fulfillment_id_idx" ON "fulfillment_line" USING btree ("fulfillment_id");--> statement-breakpoint
CREATE INDEX "fulfillment_line_order_line_id_idx" ON "fulfillment_line" USING btree ("order_line_id");--> statement-breakpoint
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_type_known" CHECK ("type" IN ('PLACED', 'FULFILLMENT_FULFILLED_ITEMS', 'CANCELED', 'ORDER_MARKED_AS_PAID', 'TRANSACTION_REFUND_REQUESTED'));--> statement-breakpoint
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_type_known" CHECK ("type" IN ('AUTHORIZATION_SUCCESS', 'AUTHORIZATION_FAILURE', 'CHARGE_SUCCESS', 'CHARGE_FAILURE', 'REFUND_REQUEST', 'REFUND_SUCCESS'));--> statement-breakpoint
-- Custom: order events are append-only like payment events (PLAN M6 decision 7). Only `user_id`
-- may change, because deleting a staff user sets it to NULL (ON DELETE SET NULL). TRUNCATE (tests
-- only) does not fire row triggers.
CREATE FUNCTION order_event_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'order_event is append-only (% is not allowed)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;--> statement-breakpoint
CREATE TRIGGER order_event_append_only
  BEFORE UPDATE OF "id", "order_id", "type", "payload", "created_at" OR DELETE ON "order_event"
  FOR EACH ROW EXECUTE FUNCTION order_event_append_only();
