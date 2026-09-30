# NexaVoice Milestone 8: Social Communication Ecosystem — Forensic Gap Analysis

**Date of Audit**: 2026-09-30  
**Audit Scope**: Milestone 8 Pre-Implementation Assessment & Baseline Verification  
**Repository State**: Clean build (`nest build`: 0 errors; `vite typecheck`: 0 errors; Backend tests: 225/225 passed; Web tests: 67/67 passed)

---

## 1. Classification Standards

In accordance with the foundational principles of NexaVoice:
* `🟢 IMPLEMENTED + VALIDATED`: Formally implemented in the domain/API/realtime layer and thoroughly validated via automated unit, integration, and security test suites.
* `🟡 PARTIAL`: Partially implemented (e.g., database schema or basic resolver exists, but missing outbox events, realtime subscriptions, edge-case validation, or complete client integration).
* `🔵 IMPLEMENTED BUT NOT VALIDATED`: Implemented in code, but lacks automated tests or runtime validation.
* `🟣 PROVIDER-DEPENDENT`: External commercial vendor integration (e.g., AWS S3, Twilio/Telnyx, OpenAI, Anthropic, ElevenLabs).
* `🟠 MOCK / TEST DOUBLE`: Deterministic in-memory double used for test environments. Never presented as production infrastructure.
* `🔴 NOT IMPLEMENTED`: Not yet present in the codebase.

---

## 2. Forensic Baseline Audit (17 Core Areas)

| Area # | Inspection Area | Forensic Finding | Status |
| :--- | :--- | :--- | :--- |
| **01** | **Repository Health** | Monorepo structured with `apps/web`, `backend/apps/api`, `database/prisma`, `packages/domain-types`. Both backend (`nest build`) and web (`tsc --noEmit`) compile with 0 errors. | `🟢 IMPLEMENTED + VALIDATED` |
| **02** | **Milestone 7 Audit** | Audited at [`milestone-7-ai-audit.md`](file:///d:/NexaVoice/docs/audits/milestone-7-ai-audit.md). AI participant model, orchestration, tool engine, post-call summaries, and handoff verified with 16 backend tests and 3 web tests passing. 0 regressions. | `🟢 IMPLEMENTED + VALIDATED` |
| **03** | **Authentication** | Canonical `User` model, JWT auth, session management (`Session`, `RefreshTokenFamily`), password reset, lockout protection (`lockoutUntil`, `failedLoginAttempts`), and token version revocation. | `🟢 IMPLEMENTED + VALIDATED` |
| **04** | **Authorization** | Dual RBAC + ABAC architecture with `AuthorizationDecisionService`, `RbacService`, `JwtAuthGuard`, `PermissionsGuard`, and granular permissions (`PermissionAction`). Zero-trust enforced. | `🟢 IMPLEMENTED + VALIDATED` |
| **05** | **Organization / Tenant Architecture** | Foundational. `AIAgent` and `PhoneNumber` have `organizationId`, but canonical `User` lacks explicit organization membership table, tenant directory boundaries, and cross-tenant isolation guards. | `🟡 PARTIAL` |
| **06** | **User & Profile Architecture** | Canonical `User` has `nexaVoiceId`, `username`, `email`, `phone`, `displayName`, `avatarUrl`, `status`, `accountState`. `UserPrivacySettings` stores privacy flags. However, separate public communication profile (timezone, locale, status text, presence visibility) is not decoupled from core account entity. | `🟡 PARTIAL` |
| **07** | **CallSession** | Authoritative call session entity in `schema.prisma` with 13 lifecycle states (`NEW` through `ENDED`), `conversationId`, `hostUserId`, and transactional state machine (`CallStateMachineService`). | `🟢 IMPLEMENTED + VALIDATED` |
| **08** | **CallParticipant** | First-class participant model with roles (`HOST`, `CO_HOST`, `PARTICIPANT`, `SPEAKER`, `LISTENER`, `AI_ASSISTANT`) and states (`INVITED` through `REMOVED`). | `🟢 IMPLEMENTED + VALIDATED` |
| **09** | **ConferenceSession** | Milestone 5 conference session, participant, and event management supporting SFU routing and moderation controls. | `🟢 IMPLEMENTED + VALIDATED` |
| **10** | **Room** | Persistent rooms (`CallRoom`) with link access, invite-only policies, and `RoomMember` management. | `🟢 IMPLEMENTED + VALIDATED` |
| **11** | **PSTN / SIP Architecture** | Milestone 6 telephony stack: `PhoneNumber`, `RoutingRule`, `SipTrunk`, `VoicemailMessage`, and `TelephonyUsage`. Toll-fraud protection validated. | `🟢 IMPLEMENTED + VALIDATED` |
| **12** | **Phone-Number Architecture** | Inventory management, carrier provisioning abstraction, E.164 normalization, and routing targets (`USER`, `ROOM`, `VOICEMAIL`). | `🟢 IMPLEMENTED + VALIDATED` |
| **13** | **AI Agent Architecture** | Versioned prompts, tool execution engine, allowlist enforcement, post-call summarization, and human handoff. | `🟢 IMPLEMENTED + VALIDATED` |
| **14** | **Realtime Infrastructure** | NestJS WebSocketGateway (`SignalingGateway`) at namespace `/realtime`. Authenticates via JWT handshake. Manages socket rooms: `user:${id}`, `call:${id}`, `conversation:${id}`. | `🟢 IMPLEMENTED + VALIDATED` |
| **15** | **Socket.IO** | Socket.IO client and server active. Realtime relays exist for call signaling and basic messaging. However, presence updates (`presence.updated`), contact request events (`contact.requested`), and typing indicator TTLs are missing. | `🟡 PARTIAL` |
| **16** | **GraphQL** | Apollo GraphQL code-first schema with authenticated resolvers (`contacts.resolver.ts`, `conversations.resolver.ts`, `messaging.resolver.ts`, `calling.resolver.ts`, `ai.resolver.ts`). | `🟢 IMPLEMENTED + VALIDATED` |
| **17** | **TanStack Router** | Strict typed route hierarchy in `apps/web/src/router/routes.tsx`. Routes for auth, calls, recordings, telephony, and AI agents. However, `contacts` route is currently a static placeholder card; no dedicated `/app/conversations/$conversationId` detail split, no `/app/notifications`, no `/app/directory`. | `🟡 PARTIAL` |
| **18** | **TanStack Query** | Query key factories in `apps/web/src/query/query-keys.ts` (`conversationKeys`, `contactKeys`, `callKeys`, `aiKeys`). Missing factories for `profileKeys`, `presenceKeys`, `notificationKeys`, `directoryKeys`. | `🟡 PARTIAL` |
| **19** | **Transactional Outbox** | `OutboxEvent` table in Prisma; `OutboxWorker` polls events with exponential backoff and dead-letter handling. Messages write outbox events, but contact changes, room invites, and call-from-conversation events do not currently emit outbox events. | `🟡 PARTIAL` |
| **20** | **Notification Infrastructure** | No `Notification` or `NotificationPreference` models in Prisma. No in-app notification center, no notification preferences, no unread notification counts. | `🔴 NOT IMPLEMENTED` |
| **21** | **Background Workers** | `OutboxWorker`, `AIWorker`, and `TelephonyWorker` running in background. No notification worker or presence expiration worker. | `🟡 PARTIAL` |
| **22** | **Search Infrastructure** | `SearchService` provides case-insensitive message search across user's conversations. `ContactsService.discoverUsers` provides privacy-preserving user discovery. Tenant-scoped directory search is missing. | `🟡 PARTIAL` |
| **23** | **Existing Tests** | Backend: 23 suites, 225 unit/integration tests passing in 49s. Web: 11 suites, 67 tests passing in 76s. Total: 292 passing tests with 0 failures and 0 regressions. | `🟢 IMPLEMENTED + VALIDATED` |
| **24** | **Object Storage** | `ObjectStorageProvider` interface implemented with `S3StorageProvider` and `LocalDiskStorageProvider`. Malware scanner interface implemented. Pre-signed upload targets supported. | `🟢 IMPLEMENTED + VALIDATED` |

---

## 3. Forensic Gap Breakdown by Milestone 8 Domain

### A. Identity & User Profiles
* **Canonical Identity Reuse**: `🟢 IMPLEMENTED + VALIDATED`. The system strictly reuses `User` with `nexaVoiceId` and UUID. No `SocialUser` or secondary identity model exists.
* **Communication Profile**: `🟡 PARTIAL`. `User` has `displayName`, `avatarUrl`, `customStatus`, `status`. However, fields for `timezone`, `locale`, `presenceVisibility`, and `contactPreferences` are not formally separated from account credentials.
* **Profile Privacy**: `🟢 IMPLEMENTED + VALIDATED`. `UserPrivacySettings` model controls discoverability (`discoverableByNexaVoiceId`, `discoverableByUsername`, `discoverableByEmail`, `discoverableByPhone`, `whoCanMessageMe`, `whoCanAddMeToGroups`).

### B. Contacts, Requests, Groups, & Blocking
* **Contact Relationships**: `🟢 IMPLEMENTED + VALIDATED`. `ContactRelationship` table exists with states (`PENDING`, `ACCEPTED`, `REJECTED`, `BLOCKED`, `REMOVED`). Mutual requests auto-accept deterministically.
* **Contact Requests**: `🟢 IMPLEMENTED + VALIDATED`. Send, accept, reject, remove, and list incoming/outgoing requests are implemented and validated in `contacts.service.spec.ts`.
* **Contact Blocking**: `🟢 IMPLEMENTED + VALIDATED`. `BlockedUser` table stores bidirectional block records. Blocking is enforced server-side in `isBlocked()` across messaging and contact requests.
* **Contact Groups & Favorites**: `🔴 NOT IMPLEMENTED`. No `ContactGroup` model exists in `schema.prisma`. Users cannot organize contacts into favorites or custom groups (e.g., Team, Clients, Family).
* **Contact Outbox & Realtime**: `🟡 PARTIAL`. Contact mutations currently update the database and audit log, but do NOT write to `OutboxEvent` or emit realtime events (`contact.requested`, `contact.accepted`).

### C. Presence & Availability Architecture
* **Presence Model**: `🔴 NOT IMPLEMENTED`. Currently, `User.status` (`ONLINE`, `IN_CALL`, `BUSY`, `AWAY`, `OFFLINE`) is stored as a column on the `User` table.
* **Database Write Amplification Prevention**: `🔴 NOT IMPLEMENTED`. There is currently no ephemeral presence store (Redis-backed). If heartbeat presence were written to PostgreSQL, it would cause catastrophic write amplification.
* **Presence Expiration (TTL & Heartbeats)**: `🔴 NOT IMPLEMENTED`. Disconnect cleanup exists on local socket maps, but multi-tab / multi-device presence expiration with TTL does not exist.
* **Multi-Device Presence Derivation**: `🔴 NOT IMPLEMENTED`. Sockets join `user:${id}`, but user-level presence is not aggregated from active device connections (e.g. desktop online + mobile online = user online).
* **Presence vs Availability Separation**: `🔴 NOT IMPLEMENTED`. Availability (routing eligibility for calls/messages) is not distinguished from ephemeral presence.

### D. Direct & Group Conversations
* **Conversation Domain**: `🟢 IMPLEMENTED + VALIDATED`. `Conversation` model with types (`DIRECT`, `GROUP`, `CHANNEL`). Deterministic lexicographical pairing (`directUserAId`, `directUserBId`) prevents duplicate direct conversations.
* **Participants & Roles**: `🟢 IMPLEMENTED + VALIDATED`. `ConversationParticipant` with `conversationRole` (`OWNER`, `ADMIN`, `MEMBER`).
* **Conversation States**: `🟡 PARTIAL`. Muting (`isMuted`) is implemented. Archiving or closing conversations is not yet modeled.
* **Call / Meeting from Conversation**: `🟡 PARTIAL`. `CallSession.conversationId` foreign key exists in Prisma, and `CallingService.initiateCall` accepts `conversationId`. However, initiating a call does not post a `CALL_EVENT` message into the conversation thread, and web UI has no "Call from Conversation" button.

### E. Messages, Delivery, & Realtime
* **Message Domain**: `🟢 IMPLEMENTED + VALIDATED`. `Message` model with `sequenceNumber`, `type`, `clientMessageId`, `deliveryStatus`, `isEdited`, `deletedAt`. Monotonic sequence increment is transactional.
* **Message Idempotency**: `🟢 IMPLEMENTED + VALIDATED`. Handled via unique constraint on `(conversationId, clientMessageId)`. Re-submitting the same client ID returns the existing message without duplicate insertion.
* **Message Ordering & Pagination**: `🟢 IMPLEMENTED + VALIDATED`. Cursor-based pagination on `sequenceNumber` with Base64 encoding. Forward and backward paging supported.
* **Delivery States & Read Receipts**: `🟡 PARTIAL`. `markConversationRead` updates `lastReadMessageId` and emits `conversation.message.read`. Delivery status tracking (`DELIVERED`) upon client receipt is partial.
* **Typing Indicators**: `🟡 PARTIAL`. Ephemeral socket events `typing-start` and `typing-stop` exist on `SignalingGateway`. Missing server-side auto-expiry timeout if client disconnects while typing.
* **Reactions**: `🟢 IMPLEMENTED + VALIDATED`. `MessageReaction` model with unique constraint `(messageId, userId, reaction)`. Upsert/delete implemented with realtime broadcasts.
* **Message Search**: `🟢 IMPLEMENTED + VALIDATED`. `SearchService` searches user-accessible messages by content with conversation scoping.

### F. Attachments & Security
* **Attachment Domain**: `🟢 IMPLEMENTED + VALIDATED`. `Attachment` model linked to `Message` with `objectKey`, `mimeType`, `sizeBytes`, and `status`.
* **Storage Provider & Pre-signed Targets**: `🟢 IMPLEMENTED + VALIDATED`. `LocalDiskStorageProvider` and `S3StorageProvider` support pre-signed PUT upload targets and authorized download streaming.
* **Malware & MIME Security**: `🟢 IMPLEMENTED + VALIDATED`. In-memory malware scan simulation quarantines infected files (`trojan.exe` test passed). Max file size enforced at 25MB.

### G. Notifications & Preferences
* **Notification Domain**: `🔴 NOT IMPLEMENTED`. No `Notification` entity in database or GraphQL.
* **Notification Preferences**: `🔴 NOT IMPLEMENTED`. No user preference matrix for email/push/in-app notification triggers.
* **Notification Outbox & Delivery**: `🔴 NOT IMPLEMENTED`. Notifications are not triggered on missed calls, contact requests, or mentions.

### H. Organization Directory & User Discovery
* **Privacy-Preserving Contact Discovery**: `🟢 IMPLEMENTED + VALIDATED`. `discoverUsers` searches by NexaVoice ID, username, or display name respecting privacy settings.
* **Hashed Address Book Sync**: `🟢 IMPLEMENTED + VALIDATED`. `syncAddressBook` matches client-provided SHA-256 hashes against opt-in phone/email users. Raw phone numbers are never stored.
* **Tenant-Scoped Organization Directory**: `🔴 NOT IMPLEMENTED`. No organizational member directory with team filtering and role visibility.

### I. Frontend Architecture & UX
* **Web Feature Architecture**: `🟡 PARTIAL`.
  * `apps/web/src/components/MessagingWorkspace.tsx` is an 1801-line monolithic component containing mock data types (`MockUser`, `MockMessage`, etc.).
  * Need to refactor and modularize into `apps/web/src/features/communication/` with reusable components (`ConversationList`, `ConversationView`, `MessageComposer`, `MessageItem`, `ContactList`, `ContactCard`, `PresenceIndicator`, `NotificationCenter`).
* **Contacts Page**: `🟡 PARTIAL`. Currently a static placeholder in `routes.tsx`. Needs full interactive contact list, request inbox, discover modal, and block list.
* **TanStack Query & Cache**: `🟡 PARTIAL`. Targeted cache updates for messages and contacts need hook wrappers (`useContacts`, `useConversations`, `useMessages`, `usePresence`).
* **Call Integration from Conversation**: `🟡 PARTIAL`. UI lacks direct "Start Audio Call" / "Start Video Call" action inside conversation header.

---

## 4. Requirement Status Classification Matrix (Milestone 8)

| Domain | Feature Area | Status | Notes & Implementation Requirements |
| :--- | :--- | :--- | :--- |
| **Identity** | Canonical Identity Reuse | `🟢 IMPLEMENTED + VALIDATED` | Reuses canonical `User`. No second identity. |
| **Profile** | User Communication Profile | `🟡 PARTIAL` | Extend schema with timezone, locale, presence visibility. |
| **Privacy** | Profile Privacy Controls | `🟢 IMPLEMENTED + VALIDATED` | `UserPrivacySettings` with granular flags. |
| **Discovery** | Controlled User Discovery | `🟢 IMPLEMENTED + VALIDATED` | Privacy-aware `discoverUsers` + hashed address book sync. |
| **Directory** | Organization Directory | `🔴 NOT IMPLEMENTED` | Add tenant-scoped directory query with member & role filtering. |
| **Contacts** | Contact Relationship Model | `🟢 IMPLEMENTED + VALIDATED` | `ContactRelationship` with 5 states. |
| **Contacts** | Contact Requests & Auto-Accept | `🟢 IMPLEMENTED + VALIDATED` | Send, accept, reject, remove, concurrent mutual resolution. |
| **Contacts** | Contact Blocking | `🟢 IMPLEMENTED + VALIDATED` | `BlockedUser` table + bidirectional server enforcement. |
| **Contacts** | Contact Groups & Favorites | `🔴 NOT IMPLEMENTED` | Add `ContactGroup` model and CRUD resolvers. |
| **Contacts** | Outbox Event Generation | `🔴 NOT IMPLEMENTED` | Emit `contact.requested`, `contact.accepted` through outbox. |
| **Presence** | Ephemeral Presence Store | `🔴 NOT IMPLEMENTED` | Redis-backed presence with zero DB write amplification. |
| **Presence** | Multi-Device Presence Derivation | `🔴 NOT IMPLEMENTED` | Aggregate active socket connections per user. |
| **Presence** | Heartbeat & TTL Expiration | `🔴 NOT IMPLEMENTED` | 30s TTL with periodic client heartbeat and automatic expiry. |
| **Presence** | Availability Separation | `🔴 NOT IMPLEMENTED` | Distinguish presence (status) from communication availability. |
| **Conversation** | Direct Conversations | `🟢 IMPLEMENTED + VALIDATED` | Deterministic pairing with unique constraints. |
| **Conversation** | Group Conversations | `🟢 IMPLEMENTED + VALIDATED` | Group creation, participant add/remove, role delegation. |
| **Conversation** | Conversation States | `🟡 PARTIAL` | Muting supported. Archiving to be added. |
| **Messages** | Message Domain & Sequence | `🟢 IMPLEMENTED + VALIDATED` | Monotonic sequence number in transaction. |
| **Messages** | Message Idempotency | `🟢 IMPLEMENTED + VALIDATED` | Client message ID deduplication. |
| **Messages** | Message Delivery States | `🟡 PARTIAL` | PENDING -> SENT -> DELIVERED -> READ. |
| **Messages** | Read Watermark / Receipts | `🟢 IMPLEMENTED + VALIDATED` | Scalable `lastReadMessageId` on participant. |
| **Messages** | Typing Indicators | `🟡 PARTIAL` | Ephemeral socket events; add server-side auto-expiry. |
| **Messages** | Reactions | `🟢 IMPLEMENTED + VALIDATED` | Normalized `MessageReaction` with unique constraint. |
| **Messages** | Message Editing & Deletion | `🟢 IMPLEMENTED + VALIDATED` | Soft deletion and author-verified editing. |
| **Attachments** | Object Storage Integration | `🟢 IMPLEMENTED + VALIDATED` | S3 / local disk with pre-signed upload URLs. |
| **Attachments** | Security & Malware Scan | `🟢 IMPLEMENTED + VALIDATED` | MIME validation, size caps (25MB), malware quarantine. |
| **Search** | Conversation Message Search | `🟢 IMPLEMENTED + VALIDATED` | User-scoped message search via `SearchService`. |
| **Calls** | Call from Conversation | `🟡 PARTIAL` | Backend has `conversationId`; wire UI action and `CALL_EVENT`. |
| **Calls** | Video / Room from Conversation | `🟡 PARTIAL` | Connect room launch to conversation thread. |
| **AI** | AI from Conversation | `🟡 PARTIAL` | Trigger AI summarization or agent assistance in conversation. |
| **Notifications** | Notification Domain | `🔴 NOT IMPLEMENTED` | Create `Notification` & `NotificationPreference` models. |
| **Notifications** | Notification Delivery | `🔴 NOT IMPLEMENTED` | Realtime socket + in-app notification center. |
| **Realtime** | Socket.IO Social Events | `🟡 PARTIAL` | Extend `SignalingGateway` with presence & contact events. |
| **Outbox** | Social Transactional Outbox | `🟡 PARTIAL` | Route contact, call-event, and notification outbox events. |
| **Frontend** | Modular Communication Feature | `🔴 NOT IMPLEMENTED` | Decompose `MessagingWorkspace.tsx` into modular components. |
| **Frontend** | Contacts Management View | `🟡 PARTIAL` | Build real interactive `ContactsView` (replace placeholder). |
| **Frontend** | TanStack Query Integration | `🟡 PARTIAL` | Add `profileKeys`, `presenceKeys`, `notificationKeys`. |
| **Frontend** | Responsive SAAS Design | `🟡 PARTIAL` | Desktop (3-panel) and mobile layouts with pure CSS tokens. |

---

## 5. Implementation Roadmap for Milestone 8

1. **Step 1: Database Schema Expansion (Prisma)**
   * Add `Notification` and `NotificationPreference` models.
   * Add `ContactGroup` and `ContactGroupMember` models.
   * Add `timezone`, `locale`, `presenceVisibility` to `User` / `UserPrivacySettings`.
   * Add `isArchived` to `ConversationParticipant`.
   * Push schema changes to Neon PostgreSQL database.

2. **Step 2: Presence & Availability Engine**
   * Create `PresenceService` utilizing Redis for ephemeral state with TTL (no DB writes).
   * Implement multi-device presence derivation (active sockets per user).
   * Add heartbeat handlers (`presence:heartbeat`) and socket disconnect listeners.
   * Add presence query and subscriptions over Socket.IO (`presence.updated`).

3. **Step 3: Contacts, Groups, & Outbox Integration**
   * Extend `ContactsService` to support user-defined contact groups (Favorites, Team, Clients).
   * Emit `contact.requested`, `contact.accepted`, `contact.blocked` through `OutboxEvent`.
   * Update `OutboxWorker` to dispatch contact events to user realtime rooms.

4. **Step 4: Notifications Domain & Preferences**
   * Create `NotificationsService` and `NotificationsResolver`.
   * Support notification triggers: `MESSAGE`, `MISSED_CALL`, `CONTACT_REQUEST`, `ROOM_INVITE`, `AI_SUMMARY`.
   * Implement notification preferences and read watermarks.

5. **Step 5: Call & AI Integration from Conversations**
   * Wire `CALL_EVENT` message emission when calls start or end in a conversation.
   * Add call initiation shortcut directly from conversation context.
   * Support AI summary delivery into conversation after call completes.

6. **Step 6: Frontend Modularization & Polish**
   * Create `apps/web/src/features/communication/`:
     * `components/ConversationList.tsx`
     * `components/ConversationView.tsx`
     * `components/MessageComposer.tsx`
     * `components/MessageItem.tsx`
     * `components/ContactList.tsx`
     * `components/ContactRequestModal.tsx`
     * `components/PresenceBadge.tsx`
     * `components/NotificationDropdown.tsx`
   * Implement TanStack Query hooks (`useContacts`, `useConversations`, `useMessages`, `usePresence`, `useNotifications`).
   * Update TanStack Router routes (`/app/contacts`, `/app/conversations`, `/app/conversations/$conversationId`, `/app/notifications`).
   * Apply premium SaaS Vanilla CSS tokens matching the design system.

7. **Step 7: Automated Testing & Validation**
   * Unit and integration tests for presence, contact groups, notifications, and call-from-conversation.
   * Concurrency and security IDOR tests.
   * Full regression test run across Milestones 1–7.

8. **Step 8: Architecture Documentation & Final Forensic Audit**
   * Create `docs/architecture/communication.md`, `contacts.md`, `presence.md`, `notifications.md`.
   * Produce `docs/audits/milestone-8-communication-audit.md`.
