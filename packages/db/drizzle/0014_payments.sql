CREATE TABLE "payment_event" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"transaction_id" uuid NOT NULL,
	"type" text NOT NULL,
	"amount" integer NOT NULL,
	"currency" text NOT NULL,
	"psp_reference" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_event_amount_not_negative" CHECK ("payment_event"."amount" >= 0),
	CONSTRAINT "payment_event_type_known" CHECK ("type" IN ('AUTHORIZATION_SUCCESS', 'AUTHORIZATION_FAILURE', 'CHARGE_SUCCESS', 'CHARGE_FAILURE'))
);
--> statement-breakpoint
CREATE TABLE "payment_transaction" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"checkout_id" uuid,
	"order_id" uuid,
	"provider" text NOT NULL,
	"name" text NOT NULL,
	"psp_reference" text DEFAULT '' NOT NULL,
	"currency" text NOT NULL,
	"authorized_amount" integer DEFAULT 0 NOT NULL,
	"charged_amount" integer DEFAULT 0 NOT NULL,
	"refunded_amount" integer DEFAULT 0 NOT NULL,
	"idempotency_key" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"modified_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payment_transaction_provider_idempotency_key_unique" UNIQUE("provider","idempotency_key"),
	CONSTRAINT "payment_transaction_authorized_not_negative" CHECK ("payment_transaction"."authorized_amount" >= 0),
	CONSTRAINT "payment_transaction_charged_not_negative" CHECK ("payment_transaction"."charged_amount" >= 0),
	CONSTRAINT "payment_transaction_refunded_not_negative" CHECK ("payment_transaction"."refunded_amount" >= 0),
	CONSTRAINT "payment_transaction_refunded_not_greater_than_charged" CHECK ("payment_transaction"."refunded_amount" <= "payment_transaction"."charged_amount"),
	CONSTRAINT "payment_transaction_one_owner" CHECK (num_nonnulls("payment_transaction"."checkout_id", "payment_transaction"."order_id") = 1)
);
--> statement-breakpoint
ALTER TABLE "payment_event" ADD CONSTRAINT "payment_event_transaction_id_payment_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."payment_transaction"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_transaction" ADD CONSTRAINT "payment_transaction_checkout_id_checkout_id_fk" FOREIGN KEY ("checkout_id") REFERENCES "public"."checkout"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payment_event_transaction_id_idx" ON "payment_event" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "payment_transaction_checkout_id_idx" ON "payment_transaction" USING btree ("checkout_id");--> statement-breakpoint
CREATE INDEX "payment_transaction_order_id_idx" ON "payment_transaction" USING btree ("order_id");--> statement-breakpoint
-- Custom: payment events are an append-only log (ARCHITECTURE §3 "Payments"); a row can be
-- inserted but never changed or removed. TRUNCATE (tests only) does not fire row triggers.
CREATE FUNCTION payment_event_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'payment_event is append-only (% is not allowed)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;--> statement-breakpoint
CREATE TRIGGER payment_event_append_only
  BEFORE UPDATE OR DELETE ON "payment_event"
  FOR EACH ROW EXECUTE FUNCTION payment_event_append_only();
