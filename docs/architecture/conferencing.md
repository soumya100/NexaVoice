# NexaVoice Conferencing & SFU Architecture

## Overview
Conferencing in NexaVoice provides multi-party audio, video, and screen sharing powered by an abstraction over Selective Forwarding Units (SFUs) such as LiveKit, Mediasoup, or Janus, with zero-trust server moderation and role management.

## State Models & Relationships
- **`ConferenceSession`**:
  - Relates 1:1 to an underlying `CallSession` of type `CONFERENCE` or `PERSISTENT_ROOM`.
  - Properties: `title`, `isLocked`, `allowScreenShare`, `allowParticipantUnmute`, `waitingRoomEnabled`, `maxParticipants`.
- **`ConferenceParticipant`**:
  - Roles: `HOST`, `CO_HOST`, `SPEAKER`, `MODERATOR`, `PARTICIPANT`, `LISTENER`.
  - Waiting State: `NONE`, `WAITING`, `JOIN_REQUESTED`, `ADMITTED`, `DENIED`.
- **`ConferenceEvent`**:
  - Audit trail of moderation actions (`PARTICIPANT_ADMITTED`, `PARTICIPANT_MUTED`, `SCREEN_SHARE_STARTED`, `ROOM_LOCKED`).

## Lineage Preservation during Escalation
When two 1:1 calls are merged (`mergeCalls`):
1. `CallSession A` is escalated to an SFU-routed `CONFERENCE`.
2. A `ConferenceSession` record is upserted referencing `CallSession A`.
3. All participants from `CallSession B` are transferred into `CallSession A`.
4. `CallSession B` is ended with reason `MERGED_INTO_CONFERENCE`, maintaining lineage via database relations.
5. In the event of a private split (`splitConferenceCall`), the newly spawned 1:1 session preserves `parentCallSessionId: conferenceCallId`.

## Moderation & Zero-Trust Verification
Moderators and hosts can:
- Mute individual or all participants.
- Admit or deny attendees from the waiting room.
- Lock the conference room to block new entries.
- Evict disruptive participants with immediate Socket.IO eviction and database state transitions.
