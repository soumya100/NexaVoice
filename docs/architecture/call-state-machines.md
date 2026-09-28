# NexaVoice Architecture — Call State Machines (Milestone 4)

## 1. State Machine Philosophy & Rules

NexaVoice enforces **strict, server-authoritative, deterministic finite state machines** for all calling entities. No state mutation can bypass the validation engine implemented in `CallStateMachineService` and typed in `@nexavoice/domain-types`.

### Core Rules:
1. **No Wildcard Transitions**: Only explicitly declared transitions in the transition matrices are permitted.
2. **Deterministic Exception Handling**: Any illegal state transition immediately throws an `InvalidCallStateTransitionException` and rejects the database transaction.
3. **Idempotent No-Ops**: If an entity is already in the requested state (e.g. `MUTE` on an already muted participant), the state machine returns gracefully without creating duplicate events.
4. **Audit Trail**: Every valid transition records an immutable `CallEvent` containing the previous state, new state, actor ID, and timestamp.

---

## 2. Entity State Transition Matrices

### 2.1 CallSession State Machine

```mermaid
stateDiagram-v2
    [*] --> RINGING: initiateCall
    RINGING --> ACCEPTED: acceptCall
    RINGING --> REJECTED: declineCall
    RINGING --> MISSED: timeout (60s)
    RINGING --> CANCELLED: cancelCall (initiator)
    ACCEPTED --> CONNECTING: ICE negotiation
    CONNECTING --> CONNECTED: media track flow
    CONNECTING --> FAILED: ICE failure
    CONNECTED --> ENDED: endCall / last participant leaves
    CONNECTED --> FAILED: network drop / media timeout
    REJECTED --> [*]
    MISSED --> [*]
    CANCELLED --> [*]
    ENDED --> [*]
    FAILED --> [*]
```

| Source State | Permitted Destination States |
| :--- | :--- |
| `RINGING` | `ACCEPTED`, `REJECTED`, `MISSED`, `CANCELLED` |
| `ACCEPTED` | `CONNECTING`, `ENDED`, `FAILED` |
| `CONNECTING` | `CONNECTED`, `FAILED`, `ENDED` |
| `CONNECTED` | `ENDED`, `FAILED` |
| `ENDED` | *(Terminal)* |
| `FAILED` | *(Terminal)* |
| `REJECTED` | *(Terminal)* |
| `MISSED` | *(Terminal)* |
| `CANCELLED` | *(Terminal)* |

---

### 2.2 CallLeg State Machine

Tracks each distinct device endpoint (browser tab, mobile app, desktop client) in the call.

```mermaid
stateDiagram-v2
    [*] --> OFFERED: device targeted
    OFFERED --> RINGING: client receives push
    OFFERED --> FAILED: unroutable
    RINGING --> ANSWERED: client clicks answer
    RINGING --> TERMINATED: other device answers / declined
    RINGING --> FAILED: client offline
    ANSWERED --> CONNECTED: WebRTC peer connection established
    ANSWERED --> FAILED: handshake failed
    CONNECTED --> TERMINATED: hang up / room close
    CONNECTED --> FAILED: connection lost
```

---

### 2.3 CallParticipant State Machine

Tracks each user's membership and audio/video status within the call.

```mermaid
stateDiagram-v2
    [*] --> INVITED: added to call
    INVITED --> RINGING: notification sent
    INVITED --> LEFT: user declines
    RINGING --> JOINED: user joins session
    RINGING --> LEFT: missed or rejected
    JOINED --> ON_HOLD: holdCall
    JOINED --> MUTED: muteParticipant
    JOINED --> LEFT: leaveCall / endCall
    JOINED --> REMOVED: removeParticipant (moderator)
    ON_HOLD --> JOINED: resumeCall
    ON_HOLD --> LEFT: leaveCall
    MUTED --> JOINED: unmute
    MUTED --> LEFT: leaveCall
    MUTED --> REMOVED: removeParticipant
    LEFT --> [*]
    REMOVED --> [*]
```

---

### 2.4 MediaSession State Machine

Tracks the underlying media transport session lifecycle:

```mermaid
stateDiagram-v2
    [*] --> INITIALIZING: media provider allocated
    INITIALIZING --> ACTIVE: tracks attached
    INITIALIZING --> CLOSED: teardown before connect
    ACTIVE --> PAUSED: all participants on hold
    ACTIVE --> MIGRATING: ICE restart / SFU failover
    ACTIVE --> CLOSED: session ended
    PAUSED --> ACTIVE: call resumed
    PAUSED --> CLOSED: session ended
    MIGRATING --> ACTIVE: migration succeeded
    MIGRATING --> CLOSED: migration failed
```

---

### 2.5 CallInvitation State Machine

Tracks invitations sent to users for group calls or rooms:

```mermaid
stateDiagram-v2
    [*] --> PENDING: invitation dispatched
    PENDING --> ACCEPTED: user accepts
    PENDING --> DECLINED: user declines
    PENDING --> EXPIRED: TTL elapsed
    PENDING --> REVOKED: moderator cancels
    ACCEPTED --> [*]
    DECLINED --> [*]
    EXPIRED --> [*]
    REVOKED --> [*]
```

---

## 3. Server Validation Implementation

The state transitions are enforced in code at two layers:
1. **Pure TypeScript Domain Layer** (`packages/domain-types/src/calling.ts`):
   - `isValidCallSessionTransition(from, to)`
   - `isValidCallLegTransition(from, to)`
   - `isValidCallParticipantTransition(from, to)`
   - `isValidMediaSessionTransition(from, to)`
   - `isValidCallInvitationTransition(from, to)`
2. **NestJS Service Layer** (`CallStateMachineService`):
   - Atomically updates Prisma database records.
   - Throws `InvalidCallStateTransitionException` if invalid.
   - Creates `CallEvent` record in same transaction.
