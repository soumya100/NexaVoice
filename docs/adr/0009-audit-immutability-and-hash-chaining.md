# ADR-0009: Database-Level Security Audit Immutability and Cryptographic Hash Chaining

## Status
Accepted

## Context
Compliance standards and forensic integrity require that security audit records cannot be mutated, purged, or tampered with by application actors or compromised privileged database accounts. If an attacker or rogue administrator gains access to the database, they might attempt to cover their tracks by modifying or deleting rows in `SecurityEvent`.

## Decision
1. **PostgreSQL Database Triggers**:
   * Implement a native PostgreSQL PL/pgSQL trigger function `prevent_security_event_mutation()` applied `BEFORE UPDATE OR DELETE ON "SecurityEvent"`.
   * The trigger unconditionally raises a SQL exception `CANNOT_MODIFY_IMMUTABLE_AUDIT_LOG`:
     `RAISE EXCEPTION 'SecurityEvent records are strictly immutable. UPDATE and DELETE operations are forbidden.';`
   * This guarantees that even raw SQL queries issued to the PostgreSQL instance cannot alter or remove historic events.

2. **Tamper-Evident Hash Chaining**:
   * Each `SecurityEvent` record includes `previousEventHash` (String, nullable for genesis record) and `eventHash` (String).
   * For the genesis record ($n = 0$), `previousEventHash` is `GENESIS_0000000000000000000000000000000000000000000000000000000000000000`.
   * For subsequent records ($n > 0$), `previousEventHash` is set to the `eventHash` of record $n - 1$.
   * `eventHash` is computed using SHA-256 over a canonical representation of the event fields:
     $$H_n = \text{SHA256}(\text{previousEventHash} + \text{action} + \text{actorId} + \text{targetType} + \text{targetId} + \text{result} + \text{timestamp})$$
   * Provide a public verification utility `verifyAuditChain(events)` that traverses the chain, recomputes hashes, and detects any data corruption, insertion, or deletion.

## Consequences
* **Positive**: Enforces append-only semantics at the database engine level; provides mathematical proof of audit trail integrity; protects against administrative repudiation.
* **Negative**: In ultra-high write concurrency environments, finding the single latest hash can introduce lock contention. For horizontal scalability across nodes, partitioned hash trees (per actor/tenant shard) can be introduced when write volume warrants.
