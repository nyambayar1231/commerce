-- Custom SQL migration file, put your code below! --
-- Custom: a draft's events are deleted with the draft (draftOrderDelete, PLAN M13). A draft never
-- became an order, so its history has nothing to keep; every other order's events stay
-- append-only (0016). The order row is still there when its events are deleted (they go first).
CREATE OR REPLACE FUNCTION order_event_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE'
    AND EXISTS (SELECT 1 FROM "order" WHERE "id" = OLD."order_id" AND "status" = 'DRAFT') THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'order_event is append-only (% is not allowed)', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;
