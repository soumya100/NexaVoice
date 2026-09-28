# Realtime Membership Revocation & Socket Room Synchronization

## Overview
In a real-time messaging architecture, maintaining consistency between persisted authorization state (PostgreSQL) and real-time event distribution (Socket.IO room subscriptions) is critical. If a participant is removed from a conversation, banned, or blocked, any active WebSocket connection joined to the conversation room must be immediately evicted. Otherwise, the client continues to receive real-time message broadcasts, presence updates, and typing indicators, violating privacy and security.

---

## 1. Threat Model: Orphaned Room Subscription
When a user is removed from a group conversation:
1. The PostgreSQL row in `ConversationParticipant` is removed.
2. In naive systems, the user's active client connection retains its subscription to room `conversation:{conversationId}`.
3. Subsequent messages sent to that conversation are broadcast to all sockets in `conversation:{conversationId}`.
4. The removed user receives private messages in real time until their socket disconnects or refreshes.

---

## 2. NexaVoice Architecture: Synchronous Multi-Socket Eviction

```
ConversationsService.removeParticipant(actorId, conversationId, targetUserId)
  │
  ├─► 1. Evaluate ABAC / RBAC Policy
  │      - Confirm actor has ADMIN or OWNER role in conversation
  │      - Confirm target is not OWNER
  │
  ├─► 2. Database Transaction
  │      - Delete / update row in ConversationParticipant
  │      - Update conversation sequence
  │
  ├─► 3. Realtime Eviction Hook: SignalingGateway.evictUserFromConversation(targetUserId, conversationId)
  │      │
  │      ├─► Look up all active sockets for targetUserId via userSockets registry
  │      ├─► For each socket:
  │      │     ├─► socket.leave(`conversation:${conversationId}`)
  │      │     └─► socket.emit('conversation.evicted', { conversationId, reason: 'REMOVED_BY_ADMIN' })
  │      │
  │      └─► Broadcast to remaining room participants:
  │            io.to(`conversation:${conversationId}`).emit('conversation.participant.removed', { ... })
  │
  └─► 4. Return success to caller
```

---

## 3. Server-Authoritative Reconnection Protection

To prevent an evicted client or malicious script from simply re-invoking `socket.emit('join_conversation', { conversationId })`, the server re-evaluates database membership on every join attempt:

```typescript
// SignalingGateway.handleJoinConversation
const isParticipant = await this.prisma.conversationParticipant.findUnique({
  where: {
    conversationId_userId: { conversationId, userId: client.data.userId }
  }
});

if (!isParticipant) {
  this.logger.warn({ event: 'join_conversation_denied', conversationId, userId });
  client.emit('error', { code: 'FORBIDDEN', message: 'You are not a member of this conversation' });
  return;
}
```

---

## 4. Multi-Device Realtime Consistency
Because users may connect from multiple concurrent devices (e.g. mobile app and web browser):
- `SignalingGateway` tracks a `Map<string, Set<string>>` of active sockets per user ID.
- `evictUserFromConversation` iterates over the entire set of sockets for that user.
- All devices belonging to the evicted user leave the room synchronously and receive eviction notices.
