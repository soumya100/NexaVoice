# NexaVoice — Milestone 3 Architecture Assessment
## Contacts, Conversations, Messaging, Attachments, Privacy & Realtime Messaging

**Date**: 2026-09-27  
**Status**: Completed & Approved  
**Author**: Principal Software Architect & Realtime Distributed Systems Team  

---

## 1. Executive Summary

With the successful completion of **Milestone 1 (Foundation)** and **Milestone 2 (Identity, Authentication, Authorization, RBAC & Security)**, NexaVoice has a verified security foundation:
* Strict identity models with canonical NexaVoice IDs (`NV-XXXX-XXXX`).
* Constant-time `scrypt` password hashing and token reuse detection.
* Hybrid RBAC + ABAC authorization engine via `AuthorizationDecisionService`.
* Universal guards (`JwtAuthGuard`, `PermissionsGuard`, `RolesGuard`).
* Realtime Socket.IO gateway with handshake authentication.

This assessment blueprints **Milestone 3**, integrating privacy-preserving contact discovery, deterministic direct & group conversations, idempotent message processing, delivery & read cursors, secure file attachments, and authorized realtime event streaming.

---

## 2. Reusable Architectural Assets & Capabilities

| Subsystem | Milestone 2 Baseline | Milestone 3 Integration Strategy |
| :--- | :--- | :--- |
| **Authentication & Identity** | `JwtAuthGuard`, `CurrentUser`, `CurrentSession`, canonical `nexaVoiceId`. | Protects all GraphQL messaging queries/mutations and WebSocket connections. Contacts are discovered by `nexaVoiceId` and username. |
| **Authorization Engine** | `AuthorizationDecisionService.authorize({ subject, action, resource, context })`. | Direct reuse for `conversation.read`, `conversation.write`, `conversation.delete`, `message.send`, `message.edit`, `message.delete`. |
| **RBAC & System Roles** | `RbacService` with `PermissionAction` enum. | Permissions (`CONVERSATION_READ`, `MESSAGE_SEND`, `MESSAGE_DELETE`, etc.) already modeled in `@nexavoice/domain-types`. |
| **Security Audit** | `SecurityAuditService` with immutable `SecurityEvent` log. | Records sensitive events: user blocking/unblocking, group admin transfers, moderator message deletions, and attachment security violations. |
| **Signaling Gateway** | Socket.IO `/realtime` namespace with JWT handshake auth. | Extends room subscriptions with authorized `join-conversation` handlers and typed message event broadcasts. |
| **Cache & Broker** | `RedisService`. | Stores ephemeral typing indicator state, presence caches, and outbox distribution. |

---

## 3. Discovered Gaps & Milestone 3 Scope

### 3.1 Contact Gaps
1. **Simplified Contact Model**: Current `Contact` model was a one-way pointer without relationship lifecycles (`PENDING`, `ACCEPTED`, `REJECTED`, `BLOCKED`, `REMOVED`).
2. **Missing Discovery Privacy Controls**: No settings existed to restrict discovery by email/phone or prevent user enumeration.
3. **No Symmetrical Block Enforcement**: Blocking was not enforced across direct conversations, group invites, or discovery.

### 3.2 Conversation Gaps
1. **Direct Conversation Duplication Risk**: Direct conversations lacked a database-level uniqueness constraint over user pairs, which could result in duplicate conversations under concurrent creation.
2. **Missing Group Roles & Administration**: Group roles (`OWNER`, `ADMIN`, `MEMBER`) and permissions were not formalized for group governance.

### 3.3 Messaging & Realtime Gaps
1. **Absence of Idempotency Key**: Mobile networks retry failed requests; missing `clientMessageId` would cause duplicate messages.
2. **No Monotonic Ordering Strategy**: Relying purely on client timestamps produces clock-skew drift across devices.
3. **Delivery & Read Tracking**: Needed a scalable cursor model (`lastDeliveredMessageId`, `lastReadMessageId`) per participant.
4. **Attachments & File Security**: Large binaries must not enter PostgreSQL; need object storage abstraction with signed access, MIME validation, and voice message metadata.
5. **Realtime Room Authorization**: Sockets must not be allowed to join arbitrary `conversation:{id}` rooms without database-verified membership.

---

## 4. Architectural Blueprints

### 4.1 Contact Relationship & Symmetrical Resolution
To prevent race conditions where User A requests User B while User B requests User A, relationships are indexed symmetrically. If an inverse pending request exists when a request is sent, the system automatically transitions the relationship to `ACCEPTED`.

```
          [Send Request]
                │
                ▼
   Is recipient blocking sender? ──Yes──► Reject / Silent Ignore
                │ No
   Does inverse PENDING exist?   ──Yes──► Auto-transition to ACCEPTED
                │ No
          Create PENDING
```

### 4.2 Deterministic Direct Conversation Identity
To mathematically guarantee that exactly one direct conversation exists between User A and User B:
* Enforce sorted ordering: `directUserAId = min(user1, user2)` and `directUserBId = max(user1, user2)`.
* Unique database constraint: `@@unique([directUserAId, directUserBId])`.

### 4.3 Idempotency & Message Ordering Strategy
1. **Idempotency Key**: Every message payload accepts an optional or required `clientMessageId` (UUIDv4 generated by the client).
2. **Constraint**: `@@unique([conversationId, clientMessageId])`. Duplicate submissions return the existing persisted message idempotently without creating a second record.
3. **Sequence Number**: Each conversation maintains an auto-incrementing monotonic sequence number (`sequenceNumber`) combined with server timestamp `createdAt` to guarantee absolute ordering regardless of client clock skew.

### 4.4 Scalable Read & Delivery State
Rather than creating individual receipt rows for every message multiplied by every participant ($O(M \times N)$ database bloat), we adopt a **Cursor-Based Participant Receipt Model**:
* `lastDeliveredMessageId`: Highest message sequence delivered to participant devices.
* `lastReadMessageId`: Highest message sequence opened by the participant.
* Realtime events `conversation.message.delivered` and `conversation.message.read` broadcast cursors efficiently.

### 4.5 Authorized Realtime Room Architecture
```
Client Socket (Authenticated via JWT)
          │
          ├────── emit('join-conversation', { conversationId }) ──────►
          │                                                            │
          │                       SignalingGateway                     │
          │                              │                             │
          │                  Verify Membership in DB                   │
          │                              │                             │
          │               Is user active participant?                  │
          │                      ├── Yes ──► client.join(`conversation:${id}`)
          │                      └── No  ──► emit('error', 'Unauthorized')
```

---

## 5. Milestone 3 Implementation Plan

1. **Domain Types (`packages/domain-types`)**:
   * Add `ContactRelationshipStatus`, `ConversationRole`, `MessageReaction`, `AttachmentDto`, `MessageCursorPagination`, and privacy types.
2. **Database Extensions (`database/prisma/schema.prisma`)**:
   * Add `ContactRelationship`, `BlockedUser`, `UserPrivacySettings`.
   * Update `Conversation` with deterministic direct keys and last message tracking.
   * Update `ConversationParticipant` with group roles, mute state, and read/delivery cursors.
   * Update `Message` with `clientMessageId`, `sequenceNumber`, `replyToMessageId`, `deletedAt`.
   * Add `MessageReaction`, `Attachment`, `MessageReport`.
   * Regenerate Prisma Client.
3. **Contacts Module (`backend/apps/api/src/modules/contacts`)**:
   * Discovery service with privacy policy filtering and anti-enumeration.
   * Relationship service: request, accept, reject, block, unblock.
   * Contacts GraphQL resolver.
4. **Conversations Module (`backend/apps/api/src/modules/conversations`)**:
   * Deterministic direct conversation resolution.
   * Group conversation creation, participant addition/removal, role transitions.
   * Conversations GraphQL resolver.
5. **Messaging Module (`backend/apps/api/src/modules/messaging`)**:
   * Idempotent message dispatcher with deduplication.
   * Monotonic sequence numbering and ordering.
   * Message editing, soft-deletion, replies, reactions.
   * Cursor-based pagination.
   * Messaging GraphQL resolver.
6. **Attachment & Media Service (`backend/apps/api/src/modules/attachments`)**:
   * Secure signed URL abstraction, voice message metadata, and validation.
7. **Realtime Socket.IO Messaging**:
   * Add conversation room authorization to `SignalingGateway`.
   * Realtime event broadcasting: message created, delivered, read, typing indicators, reactions.
8. **Frontend Messaging Application Shell (`apps/web`)**:
   * Rich interactive communication console with conversation lists, chat stage, bubble states, composer with replies/emojis, and contact drawer.
9. **Automated Testing Suite**:
   * Unit tests: relationship state machines, blocking rules, message ordering, idempotency.
   * E2E tests: GraphQL conversations, message send, deduplication, reactions, realtime room authorization.
10. **Documentation**:
    * `docs/architecture/messaging.md`, `docs/architecture/realtime-messaging.md`, `docs/security/messaging-security.md`, `docs/privacy/contact-discovery.md`, `docs/api/messaging.md`, `docs/adr/0006-message-ordering-and-idempotency.md`.
