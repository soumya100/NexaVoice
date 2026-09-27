# ADR-0006: Message Ordering and Idempotency Strategy

## Status
Accepted

## Context
In a global communication platform spanning mobile networks, desktop, and web clients, network disconnections, app crashes, and retries cause duplicate submissions and out-of-order delivery.

Relying exclusively on client timestamps produces inaccurate chronologies due to device clock skew, timezone differences, and offline queueing. Furthermore, missing deduplication keys causes users to accidentally post duplicate messages or files when poor mobile reception triggers automated HTTP/WebSocket retries.

## Decision
1. **Client Message Idempotency Key (`clientMessageId`)**:
   * Every message creation payload accepts a client-generated UUIDv4 `clientMessageId`.
   * Enforced at the database layer with a unique compound index: `@@unique([conversationId, clientMessageId])`.
   * When a duplicate `clientMessageId` is received within the same conversation, the backend handles the request idempotently: it returns the previously persisted message record with `200 OK` rather than generating an error or a second message.

2. **Monotonic Message Ordering (`sequenceNumber` + Server Timestamp)**:
   * Each conversation maintains an auto-incrementing integer sequence counter (`sequenceNumber`).
   * When a message is committed in a transaction, it receives the next monotonic sequence number for that conversation, along with server-authoritative `createdAt` timestamp.
   * Client message rendering and cursor reconciliation are ordered deterministically by:
     `ORDER BY sequenceNumber ASC, createdAt ASC`.

3. **Cursor-Based Delivery & Read Receipts**:
   * Rather than creating an $O(M \times N)$ junction table for every message delivery status per recipient, each participant record maintains cursors: `lastDeliveredMessageId` and `lastReadMessageId`.
   * Cursors advance monotonically; any message with a sequence number less than or equal to a participant's cursor is considered delivered or read by that participant.

## Consequences
* **Positive**: Absolute chronological consistency, zero duplicate messages during network retries, scalable receipt tracking, and support for offline reconciliation.
* **Negative**: Requires database transactions when incrementing conversation sequence numbers.
