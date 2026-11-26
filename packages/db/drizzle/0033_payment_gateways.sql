CREATE TABLE "payment_gateway_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"provider" text NOT NULL,
	"external_event_id" text NOT NULL,
	"type" text NOT NULL,
	"raw_body" text NOT NULL,
	"signature" text DEFAULT '' NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text DEFAULT '' NOT NULL,
	CONSTRAINT "payment_gateway_event_provider_external_id_unique" UNIQUE("provider","external_event_id")
);
--> statement-breakpoint
ALTER TABLE "payment_event" DROP CONSTRAINT "payment_event_type_known";--> statement-breakpoint
ALTER TABLE "payment_transaction" DROP CONSTRAINT "payment_transaction_refunded_not_greater_than_charged";--> statement-breakpoint
ALTER TABLE "payment_event" ADD COLUMN "external_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_event" ADD COLUMN "request_event_id" uuid;--> statement-breakpoint
ALTER TABLE "payment_transaction" ADD COLUMN "charge_pending_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transaction" ADD COLUMN "refund_pending_amount" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transaction" ADD COLUMN "charge_psp_reference" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "payment_transaction" ADD COLUMN "external_url" text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX "payment_gateway_event_unprocessed_idx" ON "payment_gateway_event" USING btree ("received_at") WHERE "payment_gateway_event"."processed_at" IS NULL;--> statement-breakpoint
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_request_event_id_payment_event_id_fk" FOREIGN KEY ("request_event_id") REFERENCES "public"."payment_event"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "payment_event_request_settled_unique" ON "payment_event" USING btree ("request_event_id") WHERE "payment_event"."type" IN ('REFUND_SUCCESS', 'REFUND_FAILURE');--> statement-breakpoint
CREATE INDEX "payment_event_request_event_id_idx" ON "payment_event" USING btree ("request_event_id");--> statement-breakpoint
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_type_known" CHECK ("type" IN ('AUTHORIZATION_REQUEST', 'AUTHORIZATION_ACTION_REQUIRED', 'AUTHORIZATION_SUCCESS', 'AUTHORIZATION_FAILURE', 'CHARGE_REQUEST', 'CHARGE_ACTION_REQUIRED', 'CHARGE_PENDING', 'CHARGE_SUCCESS', 'CHARGE_FAILURE', 'REFUND_REQUEST', 'REFUND_PENDING', 'REFUND_SUCCESS', 'REFUND_FAILURE', 'CANCEL_SUCCESS'));--> statement-breakpoint
ALTER TABLE "payment_transaction" ADD CONSTRAINT "payment_transaction_charge_pending_not_negative" CHECK ("payment_transaction"."charge_pending_amount" >= 0);--> statement-breakpoint
ALTER TABLE "payment_transaction" ADD CONSTRAINT "payment_transaction_refund_pending_not_negative" CHECK ("payment_transaction"."refund_pending_amount" >= 0);--> statement-breakpoint
ALTER TABLE "payment_transaction" ADD CONSTRAINT "payment_transaction_refunded_not_greater_than_charged" CHECK ("payment_transaction"."refunded_amount" + "payment_transaction"."refund_pending_amount" <= "payment_transaction"."charged_amount");