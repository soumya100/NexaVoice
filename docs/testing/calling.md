# NexaVoice Testing Guide — Calling Subsystem (Milestone 4)

## 1. Overview & Test Pyramid

The Calling subsystem is verified across three layers:
1. **Unit & State Machine Tests**: Deterministic validation of state transitions, guards, DTOs, and exception handling.
2. **Security & Authorization Tests**: IDOR rejection, moderator privilege verification, participant limits, and unauthenticated signaling refusal.
3. **Frontend Integration Tests**: React component rendering, TanStack Query integration, WebRTC mock doubles, and media device handling.

---

## 2. Test Suites Summary

### 2.1 Backend Tests (`backend/apps/api`)
Run via:
```powershell
npm run test --workspace=@nexavoice/api
```

Key suites:
- `src/modules/calling/services/call-state-machine.service.spec.ts`: Validates all valid and invalid transitions across `CallSession`, `CallLeg`, `CallParticipant`, `MediaSession`, and `CallInvitation`. (11 tests)
- `src/modules/calling/services/calling.service.spec.ts`: Validates call initiation, acceptance, rejection, termination, transactional outbox emission, and multi-device ring dispatch. (4 tests)
- `src/modules/calling/security/calling-security.spec.ts`: Validates zero-trust authorization, IDOR denial for non-participants, moderator-only participant ejection, participant limit (100) enforcement, and RFC 5766 HMAC-SHA1 TURN credential generation. (6 tests)
- **Total Backend Coverage**: 18 test suites, 150 tests passing.

### 2.2 Frontend Tests (`apps/web`)
Run via:
```powershell
npm run test --workspace=@nexavoice/web -- --run
```

Key suites:
- `src/test/calling.spec.tsx`:
  - `CallControls`: Renders mute, video, screen share, and hang-up controls with correct toggle states.
  - `CallTile`: Renders local and remote video streams with audio meters and indicators.
  - `ActiveCallView`: Renders connected call state with timer and participant list.
  - `ParticipantDrawer`: Displays participant roles and triggers mute actions for moderators.
  - `useCallSession`: Correctly initiates peer connections and signaling handshakes.
  - `CallModal`: Incoming call alert with Accept and Decline buttons.
  - `query-keys`: Validates `callKeys` hierarchy and cache invalidation keys.
- **Total Frontend Coverage**: 7 test files, 33 tests passing.

---

## 3. WebRTC Test Doubles & Environment Mocks

Because jsdom does not natively support WebRTC or hardware media APIs, the frontend test harness (`apps/web/src/test/setup.ts`) injects standard test doubles:
- `global.RTCPeerConnection`: Mock implementation supporting `createOffer`, `createAnswer`, `setLocalDescription`, `setRemoteDescription`, `addTrack`, `removeTrack`, `getSenders`, and `close`.
- `global.RTCSessionDescription` & `global.RTCIceCandidate`: Standard data containers.
- `navigator.mediaDevices.getUserMedia`: Mock returning fake `MediaStream` containing mock audio and video tracks.
- `navigator.mediaDevices.getDisplayMedia`: Mock returning fake screen sharing tracks.
- `navigator.mediaDevices.enumerateDevices`: Mock returning device descriptors for testing `DeviceSelector`.
