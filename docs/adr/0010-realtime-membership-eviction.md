# ADR-0010: Realtime Membership Eviction and Socket Room Synchronization

## Status
Accepted

## Context
When a user is removed from a conversation or leaves a group, their membership record in the database is deleted or marked inactive. However, in WebSocket-based architectures like Socket.IO, active client connections subscribe to rooms (e.g., `conversation:{conversationId}`). 

If the server does not actively evict the user's sockets from the room upon membership revocation, the removed user's client continues to receive real-time messages and presence events pushed to that room, creating an authorization leak and a severe privacy violation.

## Decision
1. **Immediate Multi-Socket Eviction**:
   * Implement `SignalingGateway.evictUserFromConversation(userId, conversationId)`.
   * The signaling gateway tracks all active socket connections belonging to a user across devices/tabs via its internal `userSockets: Map<string, Set<string>>`.
   * When `ConversationsService.removeParticipant` executes and validates admin/owner authorization, it immediately calls `evictUserFromConversation(userId, conversationId)`.
   * For every active socket registered to `userId`:
     1. The socket executes `.leave(\`conversation:\${conversationId}\`)`.
     2. An explicit notification event `conversation.evicted` is dispatched to the socket, informing the client that access was revoked.
   * A `conversation.participant.removed` event is broadcast to the remaining room participants.

2. **Server-Authoritative Room Join Guard**:
   * When a client attempts to join a room via `join_conversation`, `SignalingGateway.handleJoinConversation` re-validates current database membership:
     - Confirms user is an active participant in `ConversationParticipant`.
     - Confirms user is not blocked by direct conversation counterpart.
   * If validation fails, join is rejected with an authorization error and the socket is forbidden from joining the room.

## Consequences
* **Positive**: Guarantees immediate authorization consistency between PostgreSQL persistence and Socket.IO real-time event dissemination; removed participants cannot snoop on ongoing conversations.
* **Negative**: Requires real-time signaling gateway awareness within the conversation management lifecycle.
