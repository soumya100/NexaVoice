# NexaVoice Architecture — Messaging Domain

## 1. Executive Overview

The NexaVoice Messaging Architecture provides an enterprise-grade, privacy-respecting, real-time communication pipeline designed to scale from 1:1 direct communications to massive group conversations and future AI agent participants.

```
+---------------------------------------------------------------------------------------+
|                                    NexaVoice Client                                   |
|   (Web / Desktop / Mobile - Optimistic UI + Idempotent clientMessageId Generation)    |
+-------------------------------------------+-------------------------------------------+
                                            |
                       +--------------------+--------------------+
                       |                                         |
                       v                                         v
         +----------------------------+            +----------------------------+
         |      GraphQL Mutation      |            |      Socket.IO Gateway     |
         |        /api/graphql        |            |         /realtime          |
         +-------------+--------------+            +-------------+--------------+
                       |                                         |
                       v                                         v
         +----------------------------+            +----------------------------+
         |     MessagingService       |            |   SignalingGateway Room    |
         | - Idempotency Validation   |            |   - conversation:{id}      |
         | - ABAC / RBAC Membership   |            |   - Ephemeral Typing State |
         | - Deterministic Sequence   |            |   - Realtime Broadcasts    |
         +-------------+--------------+            +----------------------------+
                       |
                       v
         +----------------------------+
         |    PostgreSQL Database     |
         | - Atomic Sequence Increment|
         | - Soft Deletion / Audit    |
         | - Multi-Device Read Cursor |
         +----------------------------+
```

---

## 2. Core Domain Models

### 2.1 Conversations
A conversation represents a bounded communication context between two or more participants.

* **Direct Conversations (`DIRECT`)**:
  * **Deterministic Identity**: Enforced via `(directUserAId, directUserBId)` lexicographical sorting where `directUserAId = min(u1, u2)` and `directUserBId = max(u1, u2)`.
  * **Uniqueness**: Protected at the database engine level via `@@unique([directUserAId, directUserBId])`. Concurrent creation attempts deterministically converge on the existing record.
* **Group Conversations (`GROUP`)**:
  * Owned by a creator (`OWNER`), moderated by designated administrators (`ADMIN`), and joined by `MEMBER` users.
  * Role hierarchies are evaluated using NexaVoice ABAC capabilities (`CONVERSATION_WRITE`, `CONVERSATION_DELETE`, `MESSAGE_DELETE`).

### 2.2 Messages
Messages represent discrete communicative events containing text, voice notes, media attachments, replies, and reactions.

```prisma
model Message {
  id                String                @id @default(uuid())
  conversationId    String
  senderId          String
  clientMessageId   String?
  sequenceNumber    Int                   @default(0)
  type              MessageType           @default(TEXT)
  content           String
  replyToMessageId  String?
  deliveryStatus    MessageDeliveryStatus @default(PENDING)
  isEdited          Boolean               @default(false)
  editedAt          DateTime?
  deletedAt         DateTime?
  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt

  conversation Conversation      @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  sender       User              @relation("UserSentMessages", fields: [senderId], references: [id], onDelete: Cascade)
  replyTo      Message?          @relation("MessageReplies", fields: [replyToMessageId], references: [id], onDelete: SetNull)
  replies      Message[]         @relation("MessageReplies")
  reactions    MessageReaction[]
  attachments  Attachment[]

  @@unique([conversationId, clientMessageId])
  @@index([conversationId, sequenceNumber])
  @@index([conversationId, createdAt])
}
```

---

## 3. Message Ordering & Sequencing Strategy

1. **Monotonic Conversation Sequence**:
   * Each conversation maintains a monotonic `currentSequence` counter.
   * During `sendMessage`, the sequence is incremented atomically inside a database transaction:
     ```sql
     UPDATE "Conversation"
     SET "currentSequence" = "currentSequence" + 1, "lastMessageAt" = NOW()
     WHERE id = $1
     RETURNING "currentSequence";
     ```
   * The returned sequence number is assigned directly to the message's `sequenceNumber` attribute.
2. **Deterministic Tie-Breaking**:
   * Message display order is strictly sorted by `sequenceNumber ASC`.
   * Multiple devices syncing messages simultaneously can always achieve absolute convergence regardless of network jitter.

---

## 4. Idempotency & Network Resilience

Mobile devices often experience intermittent disconnects, connection switches (Wi-Fi to LTE), and socket reconnections.

* **Client Message ID**: Clients generate a UUID v4 `clientMessageId` prior to dispatching any message.
* **Database Constraint**: `@@unique([conversationId, clientMessageId])`.
* **Idempotent Dispatch**:
  * If a request is received with an existing `(conversationId, clientMessageId)`, the server immediately returns the previously committed message without incrementing the sequence or re-broadcasting duplicates.

---

## 5. Multi-Device Read & Delivery Tracking

To avoid $O(M \times N)$ database storage degradation (storing an individual delivery row per recipient per message), NexaVoice uses a **High-Performance Watermark Cursor Model**:

* Each `ConversationParticipant` maintains:
  * `lastDeliveredMessageId`: Highest message sequence delivered to any active device of the user.
  * `lastReadMessageId`: Highest message sequence marked as read by the user.
  * `lastReadAt`: Timestamp of the read receipt.
* When a user reads up to message $K$, an atomic cursor update occurs, and a lightweight `conversation.message.read` event is dispatched across WebSockets to all conversation participants.

---

## 6. Message Reactions & Replies

* **Reactions**:
  * Users can attach emoji reactions to messages.
  * Uniqueness is enforced via `@@unique([messageId, userId, reaction])`.
  * Reactions trigger real-time `conversation.reaction.added` and `conversation.reaction.removed` WebSocket events.
* **Replies**:
  * Must reference a valid `replyToMessageId` existing within the **same conversation**.
  * Authorization ensures the caller is an active participant with access to the parent message.

---

## 7. Soft Deletion & Compliance Retention

* **User-Visible Deletion**:
  * Authors or group moderators can delete a message for everyone.
  * Soft-deletion sets `deletedAt = NOW()` and masks content to `"[This message was deleted]"`.
* **Compliance & Legal Hold**:
  * The message record, its monotonic sequence number, and audit logs are preserved for compliance retention windows.
  * Messages under legal hold cannot be permanently purged until compliance clearance.
