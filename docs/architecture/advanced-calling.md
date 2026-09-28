# NexaVoice Advanced Calling Architecture

## Overview
Milestone 5 extends the foundational calling architecture of NexaVoice into a resilient, multi-call, multi-party communications engine. It formalizes state machine transitions, lineage tracking, and zero-trust authorization across:

1. **Call Waiting & Multi-Call Policy**:
   - Concurrency limit: Maximum 1 active media leg per user, with up to 1 concurrent held call.
   - Incoming call during an active session emits `call.waiting` to all user devices.
   - Answering incoming call automatically moves current active session to `HELD` state.
   - Atomic swapping between active and held sessions (`swapCalls`) transitions `ACTIVE -> HELD` and `HELD -> ACTIVE` inside a PostgreSQL ACID transaction.

2. **Call Transfers**:
   - **Blind Transfer**: The transferor designates a target user. A `CallTransfer` record (type: `BLIND`) is logged, an inbound `CallLeg` is provisioned for the target, and `call.incoming` is dispatched with `isTransfer: true`. The transferor cleanly leaves the session without terminating the CallSession.
   - **Attended Transfer**: The transferor holds the original call and initiates a consultation call (`initiateAttendedTransfer`) referencing `parentCallSessionId: originalCallId`. When consultation finishes, `completeAttendedTransfer` bridges the original participant with the consulted party and closes the consultation call.

3. **Conference Merging & Splitting**:
   - Merging two independent calls (`mergeCalls`) retains the first session as an escalated SFU `CONFERENCE` room, moves all participants of the second call into the first, and gracefully terminates the second call with reason `MERGED_INTO_CONFERENCE`.
   - Splitting a participant (`splitConferenceCall`) isolates that participant into a private 1:1 call with the moderator while retaining their conference lineage through `parentCallSessionId`.

4. **Waiting Room & Host Controls**:
   - Conferences can enforce waiting room admission (`waitingRoomEnabled: true`).
   - Connecting participants transition into `WaitingRoomState.WAITING` or `JOIN_REQUESTED`.
   - Moderators admit or deny participants via `admitParticipant` and `denyParticipant`.
   - Moderators can lock the conference (`lockConference`) to prevent new admissions.

5. **Cross-Device Handoff**:
   - Multi-device users can handoff an active call from one device to another without dropping the session.
   - `CallDeviceTransfer` state machine: `REQUESTED -> AUTHENTICATING -> CONNECTING -> CONNECTED -> COMPLETED`.
   - An inbound `CallLeg` is established for the target device; once connected, the source device leg is cleanly ended, achieving zero-gap continuity.

6. **Recording & Multi-party Consent**:
   - Audio/video/screen recordings track explicit participant consent (`RecordingConsent`).
   - Every active participant is registered with `PENDING` consent upon recording start.
   - Live visual status indicators (textual labels "RECORDING IN PROGRESS" / "RECORDING PAUSED", not just color) are broadcast over Socket.IO.
   - Recordings produce cryptographically signed, time-limited playback URLs.
   - Automatic speaker diarization is computed into structured `TranscriptSegment` records.
