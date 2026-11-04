-- Inventory movements and audit logs are append-only ledgers.
CREATE OR REPLACE FUNCTION offspring_block_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Table % is append-only; % is not permitted', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER inventory_movement_immutable
  BEFORE UPDATE OR DELETE ON "InventoryMovement"
  FOR EACH ROW EXECUTE FUNCTION offspring_block_mutation();

CREATE TRIGGER audit_log_immutable
  BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW EXECUTE FUNCTION offspring_block_mutation();

-- Defensive data-integrity constraints
ALTER TABLE "InventoryBatch" ADD CONSTRAINT batch_non_negative CHECK ("onHandKg" >= 0 AND "reservedKg" >= 0 AND "reservedKg" <= "onHandKg");
ALTER TABLE "PaymentAllocation" ADD CONSTRAINT allocation_positive CHECK ("amount" > 0);
ALTER TABLE "Payment" ADD CONSTRAINT payment_positive CHECK ("amount" > 0);
ALTER TABLE "Invoice" ADD CONSTRAINT invoice_paid_le_total CHECK ("amountPaid" >= 0 AND "amountPaid" <= "total");
