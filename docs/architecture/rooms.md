# NexaVoice Persistent Call Rooms Architecture

## Overview
Persistent Rooms (`CallRoom`) provide always-available audio/video meeting spaces with permanent URLs, role-based access, optional waiting rooms, and recording retention policies.

## Room Schema & Roles
- **Model: `CallRoom`**:
  - `slug`: Human-readable permanent identifier (`/app/rooms/:slug`).
  - `roomType`: `PUBLIC`, `PRIVATE`, `PROTECTED`.
  - `isPersistent`: When `true`, the room entity survives individual call sessions.
  - `waitingRoomEnabled`: Controls whether non-moderator members must be admitted before joining media streams.
  - `recordingsRetentionDays`: Automatically schedules expiration of associated recording media.
- **Model: `RoomMember`**:
  - `role`: `OWNER`, `ADMIN`, `MODERATOR`, `MEMBER`, `GUEST`.
  - `isBanned`: Explicit room-level blocklist enforcement.

## Lifecycle & Ephemeral CallSessions
When users enter a persistent room:
1. If an active `CallSession` is currently running for the room (`room.activeCallSessionId`), connecting participants join that existing session.
2. If no call session is active, the first joining member initiates a new `CallSession` linked to `roomId: room.id`.
3. When all participants leave, the `CallSession` transitions to `ENDED`, but the `CallRoom` entity remains intact for future sessions.
