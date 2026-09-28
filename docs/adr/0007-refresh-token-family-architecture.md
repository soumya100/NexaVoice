# ADR-0007: Refresh Token Family Architecture for Multi-Hop Reuse Detection

## Status
Accepted

## Context
OAuth2 and JWT-based authentication architectures require periodic rotation of refresh tokens. In the initial implementation, sessions stored only an immediate single-predecessor pointer (`replacedByTokenHash`). This was insufficient to detect multi-hop replay attacks (e.g., when token $T_1$ is rotated to $T_2$ and then to $T_3$, presenting $T_1$ while $T_3$ was active could bypass single-hop detection or fail to trace the entire lineage).

If an attacker captures an old refresh token and attempts to replay it, the authentication service must recognize that the token was already consumed, infer potential token theft, and revoke the entire lineage to protect user accounts.

## Decision
1. **Hierarchical Token Family Lineage**:
   * Introduce two explicit entities: `RefreshTokenFamily` and `RefreshToken`.
   * A `RefreshTokenFamily` binds directly to an authenticated `Session`.
   * Each token issuance ($T_1 \to T_2 \to T_3$) is recorded as an immutable row in `RefreshToken` with `familyId`, `tokenHash` (SHA-256), `issuedAt`, `expiresAt`, `usedAt`, and `replacedByTokenId`.

2. **Strict Multi-Hop Reuse Detection**:
   * During rotation, the incoming token hash is queried against the entire `RefreshToken` table with its joined family.
   * If `storedToken.usedAt !== null` or `storedToken.replacedByTokenId !== null` or `storedToken.isRevoked === true`, the system declares a `REFRESH_TOKEN_REUSE_DETECTED` security incident.
   * Inside a transactional boundary, the system immediately:
     1. Marks the entire `RefreshTokenFamily` as revoked (`isRevoked: true`, `revokedAt: now()`, `revocationReason: REFRESH_TOKEN_REUSE_DETECTED`).
     2. Marks all descendant tokens in the family as revoked (`isRevoked: true`).
     3. Marks the associated `Session` as revoked.
     4. Emits a tamper-evident `SecurityEvent` audit log.
     5. Rejects the request with HTTP 401 Unauthorized without issuing any replacement token.

3. **Concurrency and State Isolation**:
   * Token lookup, rotation, and revocation operate within database transactions to prevent race conditions during rapid concurrent refresh requests.

## Consequences
* **Positive**: Complete audit trail of token lineage, deterministic detection of multi-hop token replay attacks, automatic containment of compromised sessions.
* **Negative**: Requires maintaining historical token metadata in the database until session expiration (managed via periodic TTL cleanup).
