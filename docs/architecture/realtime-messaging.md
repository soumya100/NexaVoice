# NexaVoice Architecture — Real-Time Messaging & Socket.IO

## 1. Gateway Overview

NexaVoice delivers real-time events over a dedicated WebSocket namespace (`/realtime`) managed by `SignalingGateway` in `@nexavoice/api`.

* **Protocol**: Socket.IO v4 over WebSocket with HTTP Long-Polling fallback.
* **Authentication**: Handshake JWT token validation (`auth.token` or `query.token`) against the system's rotating token verification secret.
* **Namespace**: `/realtime`

---

## 2. Room Authorization Model

In high-concurrency communications platforms, room membership must never be blindly accepted based on client input alone. NexaVoice implements **Zero-Trust Room Joining**:

```
Client -> emit('join-conversation', { conversationId })
   │
   ├─► 1. Verify Client Authentication (reject guests / invalid JWT)
   │
   ├─► 2. Query Database: ConversationParticipant
   │      WHERE conversationId = :id AND userId = :currentUserId
   │
   ├─► 3. Verify Blocking Status
   │      Ensure caller is not blocked by direct recipient
   │
   ├─► 4. Authorization Decision
   │      - If Authorized: client.join('conversation:' + conversationId)
   │      - If Denied: emit('join_conversation_denied', { reason: 'FORBIDDEN' })
```

Sockets that fail the membership verification are immediately rejected and prohibited from subscribing to the room's event feed.

---

## 3. Realtime Event Catalog

| Event Name | Direction | Payload Schema | Description |
|:---|:---|:---|:---|
| `join-conversation` | Client ➔ Server | `{ conversationId: string }` | Requests authorized room subscription |
| `leave-conversation`| Client ➔ Server | `{ conversationId: string }` | Unsubscribes socket from room |
| `typing-start` | Client ➔ Server | `{ conversationId: string }` | Emits ephemeral typing indicator |
| `typing-stop` | Client ➔ Server | `{ conversationId: string }` | Clears ephemeral typing indicator |
| `conversation.message.created` | Server ➔ Room | `MessageGql` | New message created with sequence tie-breaker |
| `conversation.message.updated` | Server ➔ Room | `MessageGql` | Message content edited by author |
| `conversation.message.deleted` | Server ➔ Room | `{ messageId, conversationId, deletedAt }` | Soft-deleted message event |
| `conversation.message.read` | Server ➔ Room | `{ conversationId, userId, lastReadMessageId, readAt }` | Read cursor watermark advancement |
| `conversation.reaction.added` | Server ➔ Room | `{ messageId, userId, reaction, conversationId }` | Reaction added to message |
| `conversation.reaction.removed`| Server ➔ Room | `{ messageId, userId, reaction, conversationId }` | Reaction removed from message |
| `conversation.typing.started` | Server ➔ Room | `{ conversationId, userId, timestamp }` | Broadcast to other room participants |
| `conversation.typing.stopped` | Server ➔ Room | `{ conversationId, userId, timestamp }` | Broadcast to other room participants |

---

## 4. Ephemeral State Management (Typing Indicators)

* Typing indicators are purely ephemeral.
* **No Database Writes**: Typing signals bypass PostgreSQL entirely, broadcasting directly to active sockets in `conversation:{id}`.
* **Auto-Expiration**: If a `typing-stop` event is lost due to network disruption, client runtimes auto-expire remote typing indicators after 4000ms.
* **Disconnect Cleanup**: When a socket disconnects, its user rooms and presence markers are immediately purged.

---

## 5. Offline Recovery & Cursor Reconciliation

WebSocket connections on mobile devices are prone to packet drops and sleep cycles. NexaVoice treats WebSockets as an **event optimization**, while PostgreSQL remains the authoritative source of truth.

Upon reconnecting, clients execute the cursor synchronization query:
```graphql
query SyncMessages($conversationId: ID!, $cursor: String!) {
  messages(input: {
    conversationId: $conversationId,
    cursor: $cursor,
    direction: "after",
    limit: 50
  }) {
    edges {
      cursor
      node {
        id
        sequenceNumber
        content
        deliveryStatus
        reactions { reaction userId }
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
```
This guarantees zero lost messages without needing to re-fetch the entire conversation history.
