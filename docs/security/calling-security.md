# NexaVoice Security & Privacy — Calling Subsystem (Milestone 4)

## 1. Security Architecture & Threat Model

Calling in NexaVoice is designed around a **Zero-Trust Signaling & Ephemeral Credential** model:

```mermaid
graph TD
    Client[Untrusted Client] -->|1. JWT Authentication| Gateway[Signaling Gateway / GraphQL API]
    Gateway -->|2. IDOR & RBAC Check| AuthZ[CallingAuthorizationService]
    AuthZ -->|3. Check Participant Limit (100)| Limits[Call Limits Engine]
    AuthZ -->|4. Check Moderator Privileges| Roles[Moderator / Admin Check]
    Gateway -->|5. Generate Ephemeral Token| ICE[IceServerService]
    ICE -->|HMAC-SHA1 RFC 5766| TURN[TURN Relay Server]
```

---

## 2. Key Security Controls

### 2.1 Insecure Direct Object Reference (IDOR) Mitigation
- All GraphQL calling operations (`acceptCall`, `declineCall`, `joinCall`, `leaveCall`, `endCall`, `muteParticipant`, `removeParticipant`, `holdCall`, `resumeCall`) explicitly resolve `currentUser.userId` from the verified JWT.
- A caller cannot perform operations on calls they are not a part of. Attempting to access, listen to, or manipulate an unauthorized call raises `CallAuthorizationException`.

### 2.2 Moderator & Participant Authority Rules
- Only **MODERATOR** or **ADMIN** roles within a call can mute other participants or remove participants from the session.
- A participant can never remove or mute a user with equal or higher authority.
- Initiator of a call session is automatically granted the `MODERATOR` role.

### 2.3 Ephemeral TURN Credentials (RFC 5766)
- NexaVoice never shares static TURN passwords with client devices.
- TURN credentials are dynamically computed using `HMAC-SHA1(turnSecret, username)` where `username = expiryTimestamp + ":" + userId`.
- Expiry timestamps are enforced by TURN servers (e.g. coturn), preventing credential reuse beyond the active call session.

### 2.4 Participant Scalability & Abuse Limits
- Calls strictly enforce a hard ceiling of **100 concurrent participants** (`MAX_CALL_PARTICIPANTS = 100`).
- Exceeding the participant limit throws `CallParticipantLimitExceededException` and denies the join request.
- Ringing timeout is strictly capped at **60 seconds**, preventing stale abandoned ringing loops from occupying resources.

### 2.5 Media Encryption
- In Direct P2P mode, media packets are encrypted end-to-end via **DTLS-SRTP** (RFC 5763 / RFC 5764) directly between client endpoints.
- Server signaling relays SDP metadata without intercepting or retaining plaintext audio/video media streams.

### 2.6 Audit Logging
- Every call initiation, answer, rejection, termination, mute, and participant eviction is recorded in the append-only `CallEvent` database table with timestamp, actor ID, and metadata.
