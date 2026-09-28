# ADR-0008: Transactional Outbox Pattern for Realtime Event Reliability

## Status
Accepted

## Context
When a user sends a message, two operations must occur:
1. Persistence of the message and sequence update in PostgreSQL.
2. Broadcast of the message event across Redis and Socket.IO to connected room participants.

Directly publishing to Socket.IO after committing to the database introduces a dual-write hazard:
- If the Redis broker or Socket.IO signaling node experiences a transient network partition or crashes immediately after database commit, the message is stored in PostgreSQL but never delivered in real time to recipients.
- If publishing precedes the database commit, an uncommitted message could be broadcast before the database transaction aborts or rolls back, leaking phantom messages.

## Decision
1. **Transactional Outbox Table (`OutboxEvent`)**:
   * Persist an `OutboxEvent` record within the exact same database transaction as the message creation, participant cursor update, and conversation sequence advancement.
   * `OutboxEvent` schema stores:
     - `id`: Unique event UUID.
     - `eventType`: Qualified event name (e.g., `conversation.message.created`).
     - `aggregateType`: Domain entity type (e.g., `Conversation`).
     - `aggregateId`: Entity identifier (e.g., `conversationId`).
     - `payload`: Deterministic JSON payload.
     - `status`: Lifecycle state (`PENDING`, `PROCESSING`, `PROCESSED`, `FAILED`, `DEAD_LETTER`).
     - `attempts`: Retry counter.
     - `availableAt`: Next allowable execution timestamp for exponential backoff.
     - `processedAt`: Timestamp of successful broadcast.
     - `lastError`: Error message if publication encountered an exception.

2. **Asynchronous Outbox Worker**:
   * Implement a background polling worker (`OutboxWorker`) running at regular intervals (default 500ms) with concurrency locks.
   * Drains batches of `PENDING` and retryable `FAILED` events.
   * Emits each event through `SignalingGateway` / Redis.
   * On successful emission, transitions event status to `PROCESSED`.
   * On failure, increments `attempts` and applies exponential backoff:
     $$\Delta t = 2^{\text{attempts}} \times 1000\text{ ms}$$
   * If attempts reach 5, transitions event to `DEAD_LETTER` and alerts operators via structured error logging.

## Consequences
* **Positive**: Absolute atomicity between database commit and real-time event dissemination; zero lost events during Redis or Socket.IO transient outages; at-least-once delivery guarantee.
* **Negative**: Introduces minor polling latency (sub-second) for event broadcast, and requires background outbox draining capacity.
