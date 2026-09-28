# NexaVoice Advanced Calling Test Strategy & Verification

## Test Matrix
The test suite validates all Milestone 5 advanced calling capabilities across both backend services and frontend components.

### 1. Backend Service Suites
- **`backend/apps/api/src/modules/calling/services/advanced-calling.spec.ts`**:
  - `Call Waiting & Swap`: Atomic active-to-held swap and mutual hold state transition.
  - `Blind Transfer`: Transferor exit without call termination, target invitation dispatch.
  - `Attended Transfer`: Consultation call creation with `parentCallSessionId`, completion bridge.
  - `Conferencing Merge & Split`: Escalation to SFU room, participant migration, isolated 1:1 split.
  - `Waiting Room Management`: Moderator admission, denial, and socket event emission.
  - `Device Handoff`: Multi-device leg transfer, zero-gap continuity, source leg teardown.
  - `Recording Lifecycle & Consent`: Multi-party consent creation, pause/resume, signed URL generation.
  - `Scheduled Calls`: Future call planning, calendar reminders, organizer cancellation.
  - `AI Transcription & Speaker Diarization`: Speaker label segment parsing and storage.
- **`backend/apps/api/src/modules/calling/services/calling.service.spec.ts`**:
  - Call initiation, SFU routing for group calls, termination and eviction.
- **`backend/apps/api/src/modules/calling/services/calling-security.spec.ts`**:
  - IDOR security, unauthorized participant removal prevention, ephemeral TURN credential generation.
- **`backend/apps/api/src/modules/calling/services/call-state-machine.service.spec.ts`**:
  - State machine transition checks and invalid transition exceptions for sessions, legs, participants, waiting room, device handoff, recordings, and scheduled calls.

### 2. Frontend Component & Hook Suites
- **`apps/web/src/test/advanced-calling.spec.tsx`**:
  - `Query Key Factories`: Deterministic query keys for conferences, rooms, recordings, and schedule.
  - `CallWaitingBanner`: Rendering held/active call data, triggering swap and merge mutations.
  - `RecordingIndicatorBanner`: Verifying prominent textual indicators ("RECORDING IN PROGRESS" / "RECORDING PAUSED") and consent action buttons.
  - `DeviceHandoffModal`: Multi-device listing, filtering current device, and executing handoff.
  - `WaitingRoomModeratorList`: Moderator review of waiting attendees with admit/deny action triggers.
- **`apps/web/src/test/calling.spec.tsx`**:
  - Call modal interaction, controls toolbar, connection state handling.
- **`apps/web/src/test/router-guards.spec.ts` & `auth.spec.ts`**:
  - Typed route hierarchy, authentication guards, and session integrity.
