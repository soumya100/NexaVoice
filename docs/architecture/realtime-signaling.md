# NexaVoice Architecture — Realtime Signaling Subsystem (Milestone 4)

## 1. Signaling Transport & Protocol

Signaling is conducted over authenticated Socket.IO connections handled by `SignalingGateway` (`backend/apps/api/src/modules/realtime/signaling.gateway.ts`).

### Key Characteristics:
- **Authentication**: JWT verification on connection handshake. Unauthenticated sockets are rejected immediately.
- **Scoping**: Sockets are bound to user rooms (`user:{userId}`) and call rooms (`call:{callId}`).
- **Multi-Device Support**: A user may have multiple open tabs or devices. All devices in `user:{userId}` receive incoming call rings. When one device answers, a cancellation signal is sent to the other devices.
- **Zero-Trust Verification**: Before any signaling packet (`call:offer`, `call:answer`, `call:ice-candidate`) is relayed, the gateway verifies that the sender is an authorized participant in the target call session.

---

## 2. Event Catalog

### 2.1 Server-to-Client Events

| Event Name | Payload | Description |
| :--- | :--- | :--- |
| `call:incoming` | `{ callId, initiator, type, roomId }` | Dispatched to all devices of invited user(s). |
| `call:accepted` | `{ callId, acceptedByUserId }` | Notifies initiator and other legs that call was answered. |
| `call:declined` | `{ callId, declinedByUserId, reason }` | Dispatched when a participant rejects an invitation. |
| `call:ended` | `{ callId, endedByUserId, durationSeconds }` | Dispatched when the call session terminates. |
| `call:cancelled` | `{ callId }` | Dispatched to ringing devices if the initiator hangs up before answer. |
| `call:participant_joined` | `{ callId, participant }` | Dispatched to room when a new user joins. |
| `call:participant_left` | `{ callId, userId, reason }` | Dispatched to room when a user leaves or is evicted. |
| `call:participant_muted` | `{ callId, userId, mutedByUserId, mediaKind }` | Dispatched when moderator mutes a user. |
| `call:offer` | `{ callId, senderId, sdp }` | SDP Offer relayed to remote peer. |
| `call:answer` | `{ callId, senderId, sdp }` | SDP Answer relayed to remote peer. |
| `call:ice-candidate` | `{ callId, senderId, candidate }` | Trickle ICE candidate relayed to remote peer. |

### 2.2 Client-to-Server Events

| Event Name | Payload | Description |
| :--- | :--- | :--- |
| `join-call` | `{ callId }` | Subscribes socket to call room. Server verifies authorization against DB. |
| `leave-call` | `{ callId }` | Unsubscribes socket from call room. |
| `call:offer` | `{ callId, recipientId, sdp }` | Sends SDP Offer to specific recipient. Server verifies membership. |
| `call:answer` | `{ callId, recipientId, sdp }` | Sends SDP Answer to caller. Server verifies membership. |
| `call:ice-candidate` | `{ callId, recipientId, candidate }` | Sends ICE candidate. Server verifies membership. |

---

## 3. Disconnect & Network Fault Toleration

1. **Heartbeat / Ping-Pong**: Socket.IO maintains standard ping-pong timers (25s interval, 20s timeout).
2. **Ungraceful Disconnect**: If a client abruptly loses connection:
   - Sockets are automatically removed from call rooms by Socket.IO.
   - The remote peer notices `iceconnectionstatechange: disconnected` or `failed`.
   - If unrecovered within 30 seconds, `CallingService.endCall` or `leaveCall` is triggered by timeout monitor or peer notification.
3. **Session Eviction**: Moderators can forcibly kick a participant via `removeParticipant`. The server immediately calls `evictUserFromCall(callId, targetUserId)`, forcing all of that user's sockets out of the call room and emitting a terminal `call:participant_left` event.
