ALTER TABLE "order" DROP CONSTRAINT "order_status_known";--> statement-breakpoint
ALTER TABLE "order_event" DROP CONSTRAINT "order_event_type_known";--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "user_email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "billing_address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "shipping_address" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ALTER COLUMN "shipping_method_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "order" ADD COLUMN "shipping_method_id" uuid;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_shipping_method_id_shipping_method_id_fk" FOREIGN KEY ("shipping_method_id") REFERENCES "public"."shipping_method"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_complete_unless_draft" CHECK ("order"."status" = 'DRAFT' OR ("order"."user_email" IS NOT NULL AND "order"."billing_address" IS NOT NULL AND "order"."shipping_address" IS NOT NULL AND "order"."shipping_method_name" IS NOT NULL));--> statement-breakpoint
ALTER TABLE "order" ADD CONSTRAINT "order_status_known" CHECK ("status" IN ('DRAFT', 'UNFULFILLED', 'PARTIALLY_FULFILLED', 'FULFILLED', 'CANCELED'));--> statement-breakpoint
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_type_known" CHECK ("type" IN ('PLACED', 'DRAFT_CREATED', 'ADDED_PRODUCTS', 'REMOVED_PRODUCTS', 'PLACED_FROM_DRAFT', 'FULFILLMENT_FULFILLED_ITEMS', 'CANCELED', 'ORDER_MARKED_AS_PAID', 'TRANSACTION_REFUND_REQUESTED'));