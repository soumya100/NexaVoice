-- Milestone 3A Migration: SecurityEvent Immutability & Tamper Protection
-- Trigger to reject UPDATE and DELETE operations on SecurityEvent

CREATE OR REPLACE FUNCTION prevent_security_event_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'SecurityEvent records are append-only and immutable. UPDATE or DELETE operations are strictly prohibited (Milestone 3A Security Invariant).'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_security_event_update ON "SecurityEvent";
CREATE TRIGGER trg_prevent_security_event_update
BEFORE UPDATE ON "SecurityEvent"
FOR EACH ROW
EXECUTE FUNCTION prevent_security_event_mutation();

DROP TRIGGER IF EXISTS trg_prevent_security_event_delete ON "SecurityEvent";
CREATE TRIGGER trg_prevent_security_event_delete
BEFORE DELETE ON "SecurityEvent"
FOR EACH ROW
EXECUTE FUNCTION prevent_security_event_mutation();
