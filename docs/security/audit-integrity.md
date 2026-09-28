# Tamper-Evident Security Audit Integrity Architecture

## Overview
In Milestone 3A, NexaVoice implemented database-level immutability triggers and cryptographic hash chaining on the `SecurityEvent` audit trail.

## Threat Model
1. **Insider / Database Mutation**: An adversary gaining direct SQL access to the PostgreSQL database attempts to alter or delete audit rows to erase evidence of credential stuffing, privilege escalation, or unauthorized access.
2. **Reordering / Dropping Events**: An adversary attempts to selectively drop individual events or splice records from different accounts.
3. **Log Whitewashing**: An adversary attempts to rewrite timestamps or IP addresses.

## Defense Architecture

### 1. Database-Level Immutability Trigger
A PostgreSQL trigger function rejects all `UPDATE` and `DELETE` queries on `SecurityEvent`:

```sql
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
FOR EACH ROW EXECUTE FUNCTION prevent_security_event_mutation();

DROP TRIGGER IF EXISTS trg_prevent_security_event_delete ON "SecurityEvent";
CREATE TRIGGER trg_prevent_security_event_delete
BEFORE DELETE ON "SecurityEvent"
FOR EACH ROW EXECUTE FUNCTION prevent_security_event_mutation();
```

### 2. Cryptographic Hash Chaining ($H_n = \text{SHA256}(H_{n-1} + \text{canonical}(E_n))$)
Each audit record includes:
- `previousEventHash`: Cryptographic link to the preceding event (or `'GENESIS'` for the initial event).
- `eventHash`: SHA-256 hash computed over `previousEventHash` concatenated with the canonicalized event payload.

### 3. Deterministic Canonicalization
To guarantee reproducible hashing across platforms, `canonicalizeAuditEvent` produces an alphabetically sorted JSON string:
```ts
const normalized = {
  action: payload.action,
  actorId: payload.actorId ?? '',
  correlationId: payload.correlationId ?? '',
  createdAt: payload.createdAt,
  ipAddress: payload.ipAddress ?? '',
  metadataJson: payload.metadataJson ?? '{}',
  reason: payload.reason ?? '',
  result: payload.result,
  targetId: payload.targetId ?? '',
  targetType: payload.targetType ?? '',
  userAgent: payload.userAgent ?? '',
};
return JSON.stringify(normalized, Object.keys(normalized).sort());
```

### 4. Verification Utility
The `verifyAuditChain` function verifies the entire audit log in ascending chronological order:
1. Verifies that `event.previousEventHash` matches the prior event's `eventHash`.
2. Re-computes the SHA-256 hash over the canonical representation.
3. Returns `{ valid: false, brokenIndex, brokenEventId, reason }` immediately upon detecting tampering.

## What Tamper Evidence Guarantees and Does Not Guarantee
- **Guaranteed**: Any modification, insertion, deletion, or reordering of committed audit records breaks the hash chain and is immediately detectable.
- **Not Guaranteed**: It does not prevent an attacker with root database access from dropping the entire table or database; external SIEM log forwarding (implemented via `StructuredLogger`) provides offsite log retention.

## Automated Verification
Validated in [`security-audit.service.spec.ts`](file:///d:/NexaVoice/backend/apps/api/src/modules/security/security-audit.service.spec.ts):
- Deterministic canonicalization tested.
- Valid hash chain over multiple events confirmed.
- Post-hoc payload tampering detection confirmed.
- Dropped/reordered event detection confirmed.
- Database UPDATE / DELETE rejection invariant verified.
