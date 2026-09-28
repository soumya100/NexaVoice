# Milestone 3A — Forensic Remediation Assessment

This assessment documents the verified state of the 14 forensic audit findings prior to remediation, their reproducible status, proposed fixes, risks, required tests, and validation criteria.

---

## 1. Audit Findings Matrix

### Finding 1: JwtAuthGuard Dependency Resolution Failure during E2E Bootstrap
- **Current State**: `JwtAuthGuard` relied on `JwtService`, which was not consistently accessible to modules consuming guarded endpoints without clean provider exports or circular dependencies.
- **Still Reproducible?**: Resolved. `AuthenticationModule` cleanly exports `JwtService` and `JwtAuthGuard`. The NestJS dependency graph resolves without circularity.
- **Files Involved**: `backend/apps/api/src/modules/authentication/authentication.module.ts`, `backend/apps/api/src/common/guards/jwt-auth.guard.ts`.
- **Proposed Fix**: Explicitly export JWT and session providers from `AuthenticationModule` and import it into domain modules.
- **Risk**: Low. Module encapsulation is preserved.
- **Test Required**: Full E2E bootstrap in `test/auth.e2e-spec.ts`.
- **Validation Criteria**: All GraphQL queries and mutations bootstrap without missing provider injection errors.

### Finding 2: Offline JWT Fallback Bypassing tokenVersion & Session Validation
- **Current State**: In degraded database connectivity, `JwtAuthGuard` returned a default mock user with `USER` role rather than failing closed.
- **Still Reproducible?**: Resolved. `JwtAuthGuard` now explicitly checks `this.prisma.isDatabaseConnected()` and throws `ServiceUnavailableException('Authentication service degraded: database unavailable')`.
- **Files Involved**: `backend/apps/api/src/common/guards/jwt-auth.guard.ts`, `backend/apps/api/src/modules/realtime/signaling.gateway.ts`.
- **Proposed Fix**: Strictly fail closed. Deny all authentication attempts whenever the database or session validation subsystem is degraded.
- **Risk**: Low. Prevents unauthorized privilege grant during network partitions.
- **Test Required**: `jwt-auth.guard.spec.ts` database disconnection test case.
- **Validation Criteria**: `canActivate()` throws `ServiceUnavailableException` when database ping fails.

### Finding 3: Multi-Hop Refresh Token Reuse Detection Defect
- **Current State**: Single `replacedByTokenHash` on `Session` only detected immediate predecessor reuse ($T_1 \to T_2$). A multi-hop reuse ($T_1$ reused after $T_3$) succeeded or was untracked.
- **Still Reproducible?**: Resolved. Implemented `RefreshTokenFamily` and `RefreshToken` relational lineage models.
- **Files Involved**: `backend/apps/api/src/modules/authentication/session.service.ts`, `database/prisma/schema.prisma`.
- **Proposed Fix**: Track entire token family lineage. When any historical token in the lineage is presented, revoke the entire token family and the active session immediately.
- **Risk**: Low. Enhances cryptographic session protection.
- **Test Required**: `session.service.spec.ts` multi-hop rotation and reuse test ($T_1 \to T_2 \to T_3$, replay $T_1$ and $T_2$).
- **Validation Criteria**: Replay of any historical token in the lineage triggers full session revocation and returns HTTP 401.

### Finding 4: Missing Database-Level Audit Immutability & Hash Chaining
- **Current State**: `SecurityEvent` table permitted raw `UPDATE` and `DELETE` queries at the SQL level, and records were not cryptographically chained.
- **Still Reproducible?**: Resolved. Created PostgreSQL trigger function preventing `UPDATE` and `DELETE` on `SecurityEvent`. Implemented SHA-256 hash chaining ($H_n = \text{SHA256}(H_{n-1} + \text{canonical}(E_n))$).
- **Files Involved**: `database/prisma/migrations/20260927000000_audit_immutability_and_chaining/migration.sql`, `backend/apps/api/src/modules/security/security-audit.service.ts`.
- **Proposed Fix**: Add SQL triggers `BEFORE UPDATE OR DELETE ON "SecurityEvent"` raising exceptions, and store `previousEventHash` and `eventHash` per record.
- **Risk**: Low. Audit log becomes append-only and tamper-evident.
- **Test Required**: `security-audit.service.spec.ts` chain calculation and verification tests.
- **Validation Criteria**: Verification utility detects corrupted payloads or broken chains.

### Finding 5: Missing Socket.IO Room Eviction After Participant Removal
- **Current State**: When a user was removed from a group conversation, their active socket remained joined to `conversation:{id}`.
- **Still Reproducible?**: Resolved. Added `SignalingGateway.evictUserFromConversation(userId, conversationId)` and invoked it upon group participant removal.
- **Files Involved**: `backend/apps/api/src/modules/realtime/signaling.gateway.ts`, `backend/apps/api/src/modules/conversations/conversations.service.ts`.
- **Proposed Fix**: Identify all sockets belonging to `userId`, force socket `.leave()`, and emit an eviction notice.
- **Risk**: Low. Guarantees real-time consistency.
- **Test Required**: `conversations.service.spec.ts` and `signaling.gateway.spec.ts`.
- **Validation Criteria**: Evicted socket no longer receives broadcast messages from the conversation.

### Finding 6: Transactional Outbox Missing (Dual-Write Hazard)
- **Current State**: Message creation committed to PostgreSQL and immediately attempted Socket.IO broadcast. If the socket/redis layer was unreachable, broadcast failed without retry.
- **Still Reproducible?**: Resolved. Created `OutboxEvent` table and background `OutboxWorker` with exponential retry backoff.
- **Files Involved**: `backend/apps/api/src/modules/messaging/outbox.worker.ts`, `backend/apps/api/src/modules/messaging/messaging.service.ts`, `database/prisma/schema.prisma`.
- **Proposed Fix**: Save `OutboxEvent` inside the message transaction. Background worker polls, publishes, and handles dead-letter queues.
- **Risk**: Low. Guarantees at-least-once message delivery.
- **Test Required**: `outbox.worker.spec.ts` atomic commit, retry backoff, and dead-letter queue tests.
- **Validation Criteria**: Failed publications are retried up to 5 times before moving to `DEAD_LETTER`.

### Finding 7: Missing Attachment Upload/Download Handlers & Storage
- **Current State**: Attachment URLs were stubbed with no backing storage provider or authorization endpoints.
- **Still Reproducible?**: Resolved. Created `ObjectStorageProvider` with `LocalDiskStorageProvider` (development) and `S3StorageProvider` (provider-dependent), plus `AttachmentsController` (`/attachments/upload/:id`, `/attachments/download/:id`).
- **Files Involved**: `backend/apps/api/src/modules/attachments/object-storage.provider.ts`, `backend/apps/api/src/modules/attachments/local-disk-storage.provider.ts`, `backend/apps/api/src/modules/attachments/attachments.controller.ts`.
- **Proposed Fix**: Stream file uploads through signed targets or direct streaming endpoints, enforcing path traversal protection and ABAC checks.
- **Risk**: Low. Safe sandboxed storage.
- **Test Required**: `attachments.controller.spec.ts` authorization and download tests.
- **Validation Criteria**: Unauthorized users cannot download attachments even with the direct key/ID.

### Finding 8: Malware Scanning Not Actually Integrated
- **Current State**: Attachment status defaulted to `CLEAN` without scanning.
- **Still Reproducible?**: Resolved. Created `MalwareScanner` abstraction and `DeterministicDevelopmentMalwareScanner` detecting PE/ELF executables, shell scripts, and EICAR strings. Files default to `PENDING_SCAN` until validated.
- **Files Involved**: `backend/apps/api/src/modules/attachments/malware-scanner.ts`.
- **Proposed Fix**: Integrate scanner verification hook. Quarantine infected files immediately.
- **Risk**: Low. Prevents malicious payload distribution.
- **Test Required**: `attachments.controller.spec.ts` malware detection and rejection tests.
- **Validation Criteria**: Quarantined files return HTTP 422 Unprocessable Entity.

### Finding 9: Missing Security Lockout & Negative Auth Tests
- **Current State**: 5-attempt brute-force lockout was implemented in code but lacked comprehensive negative test suites.
- **Still Reproducible?**: Resolved. Created `authentication.lockout.spec.ts` verifying consecutive failures, lockout duration, audit logging, and account state checks (`SUSPENDED`, `LOCKED`, `DEACTIVATED`, `DELETED`).
- **Files Involved**: `backend/apps/api/test/authentication.lockout.spec.ts`.
- **Proposed Fix**: Add dedicated Jest unit test covering brute-force attempts and state transitions.
- **Risk**: Low.
- **Test Required**: `authentication.lockout.spec.ts`.
- **Validation Criteria**: Attempt 6 rejected with lockout message; inactive states denied login.

### Finding 10: Missing Link Preview SSRF Protection Tests
- **Current State**: SSRF validator existed in `LinkPreviewService` but lacked a comprehensive IP range test suite.
- **Still Reproducible?**: Resolved. Created `link-preview.service.spec.ts` covering private IPv4 (`127.0.0.1`, `10.0.0.1`, `172.16.0.1`, `192.168.1.1`, `169.254.169.254`), private IPv6 (`::1`, `fc00::`), cloud metadata endpoints, and DNS rebinding attacks.
- **Files Involved**: `backend/apps/api/src/modules/messaging/link-preview.service.spec.ts`.
- **Proposed Fix**: Mock DNS lookups and verify rejection of internal network ranges.
- **Risk**: Low.
- **Test Required**: `link-preview.service.spec.ts`.
- **Validation Criteria**: All RFC 1918 / RFC 3927 / loopback requests are rejected with `BadRequestException`.

### Finding 11: Missing Address-Book Privacy Matching Tests
- **Current State**: Contact matching lacked unit tests verifying that raw contacts are never persisted and matching uses normalized SHA-256 hashes.
- **Still Reproducible?**: Resolved. Created unit tests in `contacts.service.spec.ts` testing batch limit (500 entries), discovery toggle, and blocked user suppression.
- **Files Involved**: `backend/apps/api/src/modules/contacts/contacts.service.spec.ts`.
- **Proposed Fix**: Validate hashing, normalization, and contact exclusion in unit tests.
- **Risk**: Low.
- **Test Required**: `contacts.service.spec.ts`.
- **Validation Criteria**: Raw phone/email never stored; discovery opt-out strictly respected.

### Finding 12: Group Conversation Blocking Negative Tests
- **Current State**: Unclear semantics for blocked participants in existing shared groups.
- **Still Reproducible?**: Resolved. Documented block semantics and verified member moderation rules in `conversations.service.spec.ts`.
- **Files Involved**: `backend/apps/api/src/modules/conversations/conversations.service.spec.ts`.
- **Proposed Fix**: Blocked relationships suppress direct messaging and contact requests. In groups, non-admins cannot remove members or add participants.
- **Risk**: Low.
- **Test Required**: `conversations.service.spec.ts`.
- **Validation Criteria**: Member-to-member removal is rejected with `ForbiddenException`.

### Finding 13: Frontend Messaging Still Using Mock React State
- **Current State**: Frontend chat component used hardcoded static state rather than querying the backend.
- **Still Reproducible?**: Resolved. Built `apps/web/src/services/api.ts` with real GraphQL client queries (`GET_CONVERSATIONS`, `GET_MESSAGES`) and mutations (`SEND_MESSAGE`, `ADD_REACTION`, etc.).
- **Files Involved**: `apps/web/src/services/api.ts`, `apps/web/src/components/MessagingWorkspace.tsx`.
- **Proposed Fix**: Wire `MessagingWorkspace` to GraphQL endpoints with live state updates.
- **Risk**: Low.
- **Test Required**: Frontend build (`npm run build --workspace=@nexavoice/web`) and typecheck.
- **Validation Criteria**: Component compiles cleanly with real backend integration.

### Finding 14: Frontend Lacked Live Socket.IO Connection
- **Current State**: No WebSocket client existed in the web app.
- **Still Reproducible?**: Resolved. Built `apps/web/src/services/realtime.ts` connecting to `/realtime` namespace with reconnect handlers, typing indicators, room management, and live message dispatch.
- **Files Involved**: `apps/web/src/services/realtime.ts`, `apps/web/src/components/MessagingWorkspace.tsx`.
- **Proposed Fix**: Create singleton Socket.IO service and hook into `MessagingWorkspace`.
- **Risk**: Low.
- **Test Required**: `npm run build --workspace=@nexavoice/web`.
- **Validation Criteria**: Real-time status badge and live event listeners active.
