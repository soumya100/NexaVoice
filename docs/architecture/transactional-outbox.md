# Architectural Decision Record: Transactional Outbox Pattern for Realtime Messaging

## Status
ACCEPTED & IMPLEMENTED (Milestone 3A)

## Context & Problem Statement
In previous iterations, when a user dispatched a message, the system executed the database insertion in a PostgreSQL transaction and immediately broadcasted the event to Socket.IO (`this.signalingGateway.broadcastToConversation`).

This created a classic **dual-write consistency defect**:
1. If the database transaction committed but the process crashed before or during the Socket.IO / Redis publication, the event was silently lost. The message existed in the database, but active connected clients never received the realtime notification.
2. If the Socket.IO broadcast succeeded first or concurrent network failures occurred, external observers saw state that was not durably committed to the database.

## Architecture & Solution

### 1. Atomic Outbox Event Persistence
The PostgreSQL message transaction has been refactored to atomically persist an `OutboxEvent` within the same database transaction:

```sql
BEGIN TRANSACTION;
  -- 1. Validate participant membership and block status
  -- 2. Monotonically increment conversation sequenceNumber
  -- 3. Insert Message
  -- 4. Link pre-uploaded attachments
  -- 5. Insert OutboxEvent (status = 'PENDING')
COMMIT;
```

### 2. Outbox Schema
```prisma
model OutboxEvent {
  id            String    @id @default(uuid())
  eventType     String    // e.g. "conversation.message.created"
  aggregateType String    // e.g. "Conversation", "User"
  aggregateId   String    // e.g. conversationId
  payloadJson   String    // Serialized event payload
  status        String    @default("PENDING") // PENDING, PROCESSED, DEAD_LETTER
  attempts      Int       @default(0)
  maxAttempts   Int       @default(5)
  lastError     String?
  correlationId String?
  availableAt   DateTime  @default(now())
  createdAt     DateTime  @default(now())
  processedAt   DateTime?

  @@index([status, availableAt])
  @@index([aggregateId])
  @@index([createdAt])
}
```

### 3. Outbox Worker (`OutboxWorker`)
An asynchronous background worker (`modules/messaging/outbox.worker.ts`) operates continuously:
- **Polling & Fast-Path Dispatch**: Periodically polls for `status: PENDING` events where `availableAt <= NOW()`. An immediate `drainPendingEvents()` call is also triggered asynchronously on message commit to minimize end-to-end delivery latency.
- **Idempotent Broadcast**: Broadcasts the deserialized payload via `SignalingGateway`.
- **Atomic Success Transition**: Marks the outbox event as `PROCESSED` with a timestamp only *after* successful publication.
- **Exponential Backoff**: On transient failures (e.g. Redis socket transport down), increments `attempts` and reschedules `availableAt` using exponential backoff ($2^{\text{attempts}}$ seconds).
- **Dead-Letter Handling**: If `attempts >= maxAttempts` (default: 5), moves the event to `DEAD_LETTER` and alerts operators via structured error logging without crashing the pipeline.

## Verification Evidence
Automated unit tests in [`outbox.worker.spec.ts`](file:///d:/NexaVoice/backend/apps/api/src/modules/messaging/outbox.worker.spec.ts) prove:
1. Message + outbox atomicity.
2. Exponential backoff on publisher failure.
3. Dead-letter queue isolation upon reaching maximum attempts.
4. Clean degradation when database connection is unavailable.
