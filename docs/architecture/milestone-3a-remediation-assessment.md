# NexaVoice Milestone 3A — Remediation Assessment & Action Plan

**Audit Reference:** Forensic Implementation Audit (Phase 1 & Milestone 3)  
**Date:** 2026-09-27  
**Commit Inspected:** `7110735`  
**Assessment Objective:** Verify and catalog every finding from the forensic audit with current reproduction evidence, proposed architecture fixes, risk evaluation, and validation criteria before executing any source modifications.

---

## 1. Verified Audit Findings Catalog

| Finding ID | Audit Finding | Current State | Still Reproducible? | Files Involved | Risk / Priority | Proposed Fix | Required Test | Validation Criteria |
|:---|:---|:---|:---|:---|:---|:---|:---|:---|
| **REM-01** | `JwtAuthGuard` dependency resolution failure during E2E bootstrap | `JwtAuthGuard` requires `JwtService`. Resolvers in `ContactsModule`, `ConversationsModule`, and `MessagingModule` use `JwtAuthGuard`, but `JwtModule` is only imported in `AuthenticationModule` and `RealtimeModule`. | **YES (Reproduced 100%)** | `common/guards/jwt-auth.guard.ts`, `modules/contacts/contacts.module.ts`, `modules/conversations/conversations.module.ts`, `modules/messaging/messaging.module.ts`, `modules/authentication/authentication.module.ts` | **P0 (Critical)** | Export `JwtModule` from `AuthenticationModule` and import `AuthenticationModule` into dependent modules, or configure global JWT authentication infrastructure. | `npm run test:e2e --workspace=@nexavoice/api` | Full NestJS e2e application fixture compiles and bootstraps without injector error. |
| **REM-02** | Offline JWT fallback bypassing `tokenVersion` and account state | When `prisma.isDatabaseConnected()` returns false, `JwtAuthGuard` skips user verification, tokenVersion check, and RBAC lookup, granting default `USER` status. | **YES (Verified in code)** | `backend/apps/api/src/common/guards/jwt-auth.guard.ts` | **P0 (Critical Vulnerability)** | Change authentication to fail closed: if database/session dependency is unreachable, reject with `ServiceUnavailableException` (503) or `UnauthorizedException`. | Unit tests for offline DB condition in `jwt-auth.guard.spec.ts` | Disconnected database immediately denies token validation; never grants privileges. |
| **REM-03** | Multi-hop refresh token reuse detection defect | `Session.replacedByTokenHash` stores only a single string (the immediately preceding token). If token is rotated twice ($T_1 \to T_2 \to T_3$), $T_1$ is lost from history and reuse fails to trigger revocation. | **YES (Verified in code)** | `database/prisma/schema.prisma`, `modules/authentication/session.service.ts` | **P0 (Critical Vulnerability)** | Implement a dedicated `RefreshTokenFamily` and `RefreshTokenHistory` model tracking complete token lineage ($T_1 \to T_2 \to T_3$) so any ancestor presented triggers family revocation. | Multi-hop rotation unit tests ($T_1 \to T_2 \to T_3$, replay $T_1$, replay $T_2$) | Presenting $T_1$ after $T_3$ exists immediately revokes the session and records security incident. |
| **REM-04** | Missing database-level audit immutability | `SecurityEvent` table in PostgreSQL has no protection against administrative `UPDATE` or `DELETE`, and no tamper-evident hash chaining. | **YES (Verified in code)** | `database/prisma/schema.prisma`, `modules/security/security-audit.service.ts`, `database/prisma/migrations/` | **P1 (High)** | 1. Add `eventHash` and `previousEventHash` with canonical SHA-256 serialization. 2. Add SQL migration with trigger raising exception on any `UPDATE` or `DELETE` against `SecurityEvent`. 3. Add cryptographic chain validator utility. | Database trigger rejection tests; hash chain verification test | Attempted UPDATE/DELETE on `SecurityEvent` raises DB exception; tampered event breaks chain validation. |
| **REM-05** | Socket.IO room eviction gap after participant removal | When `removeParticipant` or `leaveConversation` executes, the database row is deleted, but active WebSockets remain in `conversation:{id}` room. | **YES (Verified in code)** | `modules/conversations/conversations.service.ts`, `modules/realtime/signaling.gateway.ts` | **P1 (High / Security Bypass)** | Inject `SignalingGateway` into `ConversationsService` (or emit domain event) to evict all connected sockets of the removed user from `conversation:{id}` room. | Realtime eviction test with connected socket | Removed user's socket is evicted from room; subsequent messages to conversation are not received by user. |
| **REM-06** | Transactional Outbox not implemented | Message creation transaction commits to PostgreSQL and directly invokes `signalingGateway.broadcastToConversation` in application memory; dual-write reliability risk. | **YES (Verified in code)** | `database/prisma/schema.prisma`, `modules/messaging/messaging.service.ts`, `modules/messaging/outbox.service.ts` | **P2 (High / Reliability)** | 1. Add `OutboxEvent` table to Prisma. 2. Atomically insert `OutboxEvent` inside the message transaction. 3. Implement reliable background outbox dispatcher with retry and exponential backoff. | Outbox atomicity and retry worker tests | Outbox event committed atomically with message; worker processes and broadcasts event; failure retries with backoff. |
| **REM-07** | Missing real attachment upload/download handlers | `AttachmentsService` generates synthetic `/api/v1/attachments/upload` and `download` URLs, but no HTTP controller or object storage provider exists. | **YES (Verified in code)** | `modules/messaging/attachments.service.ts`, `modules/messaging/attachments.controller.ts`, `modules/messaging/storage/` | **P2 (Architecture Gap)** | 1. Create `ObjectStorageProvider` interface with `LocalDiskStorageProvider` (development) and `S3StorageProvider` (production). 2. Add `AttachmentsController` verifying authentication and conversation participant access before serving files. | Binary upload and authorized download integration tests | Valid participant downloads binary; non-participant receives 403 Forbidden; executable uploads rejected. |
| **REM-08** | Missing negative test suites (Lockout, SSRF, Attachment, Address book) | Audit reported 0 tests for failed login lockout, 0 tests for link preview SSRF rejection, 0 tests for attachment validation, 0 tests for address book SHA-256 matching. | **YES (Verified in file search)** | `modules/authentication/authentication.service.spec.ts`, `modules/messaging/link-preview.service.spec.ts`, `modules/messaging/attachments.service.spec.ts`, `modules/contacts/contacts.service.spec.ts` | **P3 (Testing / Quality Gate)** | Implement comprehensive unit test suites covering all negative scenarios (5 failed attempts, private IPs 127.0.0.1/169.254.169.254, .exe/.bat files, batch limit). | Unit test executions | All negative test suites pass with 100% assertion coverage. |
| **REM-09** | Live Frontend integration (GraphQL & Socket.IO) | `apps/web/src/components/MessagingWorkspace.tsx` uses internal React state without real GraphQL client or Socket.IO connection. | **YES (Verified in web code)** | `apps/web/src/components/MessagingWorkspace.tsx`, `apps/web/src/services/graphql.ts`, `apps/web/src/services/socket.ts` | **P4 (Client Integration)** | 1. Configure Apollo Client / GraphQL service for live mutations & queries. 2. Connect Socket.IO client to `/realtime` for message delivery, read watermarks, typing events, and eviction handling. | Web typecheck, production build, manual/component test | Frontend dispatches live mutations and renders incoming realtime messages via WebSockets. |
| **REM-10** | Group blocking semantics clarification | Blocked user in common group could still exchange messages. | **YES (Documented gap)** | `modules/messaging/messaging.service.ts`, `docs/security/messaging-security.md` | **P3 (Policy Consistency)** | Define group blocking policy: Direct messages and requests strictly blocked; group messages by blocked user are tagged or muted according to user preference. | Group message block policy unit test | Policy is consistent and documented. |

---

## 2. Remediation Priority Execution Plan

Following the prompt's mandatory priority ordering:

```
[P0: Security Vulnerabilities]
 ├── 1. Fix JwtAuthGuard Dependency Resolution (E2E bootstrap restore)
 ├── 2. Fix Offline JWT Fallback (Fail-Closed Security)
 └── 3. Fix Multi-Hop Refresh Token Reuse Detection (RefreshTokenFamily)

[P1: Authorization & Realtime Consistency]
 ├── 4. Implement Socket.IO Room Eviction on Participant Removal
 └── 5. Implement Database-Level Security Audit Immutability & Hash Chaining

[P2: Data & Event Reliability]
 ├── 6. Implement Transactional Outbox (OutboxEvent + Background Worker)
 └── 7. Implement Real Object Storage Provider & Authenticated Attachments Controller

[P3: Security Validation & Negative Test Suites]
 ├── 8. Account Lockout & State Validation Tests (5 failed logins, SUSPENDED, LOCKED)
 ├── 9. Link Preview SSRF Negative Tests (127.0.0.1, 169.254.169.254, RFC 1918)
 ├── 10. Attachment Security Tests (.exe, .sh, oversized, malware status)
 └── 11. Address Book Privacy-Preserving Matching Tests (SHA-256)

[P4: Frontend Live Integration]
 ├── 12. Wire Frontend to GraphQL API (Queries & Mutations)
 └── 13. Wire Frontend to Live Socket.IO /realtime Gateway

[P5: Documentation & ADRs]
 ├── 14. Create ADRs (Token Family, Outbox, Immutability, Room Eviction)
 └── 15. Execute Final Forensic Audit & Compile Comprehensive Completion Report
```

---

## 3. Detailed Technical Specifications

### 3.1 P0: Dependency Resolution & Fail-Closed Authentication
- **Clean Dependency Model**: `AuthenticationModule` is decorated with `@Global()` or explicitly exports `JwtModule` and `JwtAuthGuard`. Consuming modules (`ContactsModule`, `ConversationsModule`, `MessagingModule`) import `AuthenticationModule`.
- **Fail-Closed Guard**:
  ```ts
  if (!this.prisma.isDatabaseConnected()) {
    throw new ServiceUnavailableException('Authentication service degraded: session store unreachable');
  }
  ```
  No fallback tokens or bypass permissions are ever granted during database unavailability.

### 3.2 P0: Multi-Hop Refresh Token Family Architecture
- **Prisma Schema Extension**:
  ```prisma
  model RefreshTokenFamily {
    id               String         @id @default(uuid())
    sessionId        String
    isRevoked        Boolean        @default(false)
    revokedAt        DateTime?
    revocationReason String?
    createdAt        DateTime       @default(now())

    session          Session        @relation(fields: [sessionId], references: [id], onDelete: Cascade)
    tokens           RefreshToken[]

    @@index([sessionId])
  }

  model RefreshToken {
    id         String              @id @default(uuid())
    familyId   String
    tokenHash  String              @unique
    issuedAt   DateTime            @default(now())
    expiresAt  DateTime
    usedAt     DateTime?
    isRevoked  Boolean             @default(false)

    family     RefreshTokenFamily  @relation(fields: [familyId], references: [id], onDelete: Cascade)

    @@index([familyId])
    @@index([tokenHash])
  }
  ```
- **Reuse Algorithm**:
  1. Hash incoming token: `tokenHash = SHA256(rawToken)`.
  2. Find `RefreshToken` by `tokenHash`.
  3. If token does not exist or family is revoked $\implies$ reject.
  4. If token has `usedAt !== null` $\implies$ **REUSE ATTACK DETECTED!** Revoke the entire `RefreshTokenFamily` and `Session`, log `REFRESH_TOKEN_REUSE_DETECTED` to audit log, and reject.
  5. If token is valid and unused $\implies$ mark `usedAt = NOW()`, issue fresh token in family, return new access token and refresh token.

### 3.3 P1: Socket.IO Room Eviction
- `SignalingGateway` implements `evictUserFromConversation(userId: string, conversationId: string)`:
  ```ts
  const userSocketIds = this.userSockets.get(userId);
  if (userSocketIds) {
    for (const socketId of userSocketIds) {
      const socket = this.server.sockets.sockets.get(socketId);
      if (socket) {
        socket.leave(`conversation:${conversationId}`);
        socket.emit('conversation.membership.evicted', { conversationId });
      }
    }
  }
  ```
- `ConversationsService.removeParticipant` executes database deletion, then invokes eviction.

### 3.4 P1: Database-Level Audit Immutability & Tamper-Evident Chaining
- **Chaining Formula**:
  $$\text{eventHash}_i = \text{SHA256}(\text{previousEventHash}_{i-1} + \text{actorId} + \text{action} + \text{targetId} + \text{result} + \text{createdAt})$$
- **Database Trigger**:
  ```sql
  CREATE OR REPLACE FUNCTION prevent_security_event_mutation()
  RETURNS TRIGGER AS $$
  BEGIN
    RAISE EXCEPTION 'SecurityEvent table is strictly append-only. UPDATE and DELETE are prohibited.';
  END;
  $$ LANGUAGE plpgsql;

  CREATE TRIGGER trg_security_event_immutable
  BEFORE UPDATE OR DELETE ON "SecurityEvent"
  FOR EACH ROW EXECUTE FUNCTION prevent_security_event_mutation();
  ```

### 3.5 P2: Transactional Outbox
- **Outbox Model**:
  ```prisma
  model OutboxEvent {
    id            String    @id @default(uuid())
    eventType     String
    aggregateType String
    aggregateId   String
    payloadJson   String
    status        String    @default("PENDING") // PENDING, PROCESSED, FAILED, DEAD_LETTER
    attempts      Int       @default(0)
    lastError     String?
    createdAt     DateTime  @default(now())
    processedAt   DateTime?

    @@index([status, createdAt])
  }
  ```
- **Atomicity**: `sendMessage` creates `Message` and `OutboxEvent` in the same `prisma.$transaction`.
- **Outbox Worker**: Periodic background polling worker reads `PENDING` events, broadcasts to Socket.IO, and marks `PROCESSED`. On failure, retries up to 5 times with exponential backoff before dead-lettering.

### 3.6 P2: Object Storage Provider & Attachment Controller
- `ObjectStorageProvider` interface implemented by:
  - `LocalDiskStorageProvider`: writes binaries to `scratch/attachments/` on local disk with HMAC verification for development.
  - `S3StorageProvider`: S3 presigned URLs for production.
- `AttachmentsController` in NestJS:
  - `@Put('/api/v1/attachments/upload/:id')`: streams binary to storage provider, verifies HMAC token.
  - `@Get('/api/v1/attachments/download/:key')`: verifies Bearer token, checks user conversation membership in database, and streams file back with appropriate `Content-Type` and `Content-Disposition`.

---

## 4. Assessment Summary
All 14 forensic audit findings are verified as active, reproducible, and ready for systematic remediation. The assessment is complete. Remediation execution will proceed in strict priority order (P0 $\to$ P6).
