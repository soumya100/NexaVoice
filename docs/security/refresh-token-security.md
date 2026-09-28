# Refresh Token Security & Multi-Hop Reuse Detection

## Overview
In Milestone 3A, NexaVoice replaced the legacy single-ancestor tracking mechanism (`Session.replacedByTokenHash`) with a comprehensive **Token Family and Lineage History Architecture** (`RefreshTokenFamily` and `RefreshToken`).

## The Multi-Hop Token Reuse Vulnerability
In a single-ancestor model, only the immediate previous token is remembered:
$$T_1 \xrightarrow{\text{rotate}} T_2 \xrightarrow{\text{rotate}} T_3$$
When session rotates to $T_3$, the session record stores:
- `tokenHash`: $\text{hash}(T_3)$
- `replacedByTokenHash`: $\text{hash}(T_2)$

If an attacker stole token $T_1$ and presented it *after* $T_3$ had already been issued, the database check `where: { replacedByTokenHash: hash(T1) }` returned `null`! The system failed to recognize $T_1$ as a compromised ancestor, leaving the active session open.

## Architecture & Lineage Model
Milestone 3A introduces dedicated tables to record the entire token tree:

### Schema Entities
1. **`RefreshTokenFamily`**:
   - `id`: UUID
   - `sessionId`: Foreign key to `Session`
   - `isRevoked`: Boolean flag
   - `revokedAt`: Timestamp
   - `revocationReason`: e.g., `REFRESH_TOKEN_REUSE_DETECTED`

2. **`RefreshToken`**:
   - `id`: UUID
   - `familyId`: Foreign key to `RefreshTokenFamily`
   - `tokenHash`: SHA-256 hash of high-entropy token (32 bytes raw entropy)
   - `issuedAt`: Timestamp
   - `expiresAt`: Expiration boundary
   - `usedAt`: Nullable timestamp recording exactly when the token was rotated
   - `replacedByTokenId`: Foreign key linking to the child token in the lineage
   - `revokedAt`: Timestamp
   - `isRevoked`: Boolean flag

## Reuse Detection Protocol
Whenever a refresh token $T_x$ is presented to `SessionService.rotateRefreshToken(rawToken)`:
1. Compute $H_x = \text{SHA256}(T_x)$.
2. Query `RefreshToken` by `tokenHash = H_x` with eager family and session relations.
3. If `usedAt !== null` or `replacedByTokenId !== null` or `isRevoked === true`:
   - **Compromise Confirmed**: A previously rotated token in the lineage was presented again.
   - **Immediate Revocation**: In an atomic transaction:
     - Mark `RefreshTokenFamily.isRevoked = true`
     - Mark all `RefreshToken` entries in the family as `isRevoked = true`
     - Mark `Session.isRevoked = true` with reason `REFRESH_TOKEN_REUSE_DETECTED`
   - **Audit Record**: Log `REFRESH_TOKEN_REUSE_DETECTED` security incident with IP and User-Agent.
   - **Fail Closed**: Throw `UnauthorizedException`. Never issue a new token.
4. If `usedAt === null`:
   - Token is the active tip of the family lineage.
   - Atomically create $T_{x+1}$, mark $T_x.usedAt = \text{now()}$, and set $T_x.replacedByTokenId = T_{x+1}.id$.
   - Return $T_{x+1}$ to the client.

## Test Validation
Verified by [`session.service.spec.ts`](file:///d:/NexaVoice/backend/apps/api/src/modules/authentication/session.service.spec.ts):
- $T_1 \to T_2$ rotation succeeds.
- $T_1$ reused after $T_2$ triggers immediate revocation.
- $T_1 \to T_2 \to T_3$ multi-hop rotation succeeds.
- $T_1$ reused after $T_3$ triggers immediate revocation of the entire family.
- $T_2$ reused after $T_3$ triggers immediate revocation of the entire family.
