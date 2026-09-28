# Telephony Test Suite & Verification Matrix

## Test Strategy

Telephony verification spans 3 levels:
1. **Unit & Contract Testing**: Tests provider adapters against their interface contracts, normalizer parsing, E.164 rules, fraud limits, and state machines.
2. **Integration Testing**: Tests webhook signature verification, outbox event generation, database mutations, and IDOR access control.
3. **Web Client Integration**: Tests TanStack Query key factories, dialer interaction, and number inventory management.

## Test Coverage

- **Normalizer Tests (`PhoneNumberNormalizerService`)**:
  - Standard US numbers normalization into E.164 (`+14155552671`) and display format (`+1 (415) 555-2671`).
  - UK numbers with national trunk prefix removal (`020 ...` -> `+4420...`).
  - Emergency number classification (`911`, `112`, `999`).
  - Toll-free classification (`800`, `888`, `877`).
  - High-risk premium & satellite destination detection (`900`, `+870`).
- **Fraud Protection Tests (`TollFraudProtectionService`)**:
  - Blocking premium destinations.
  - Blocking countries outside allowed list.
  - Per-minute rate limit enforcement.
  - Concurrent call limit enforcement.
- **Provider Contract Tests**:
  - `MockTelephonyProvider`: capabilities, signature verification, call initiation.
  - `TwilioTelephonyProvider`: capabilities, HMAC-SHA1 signature verification.
  - `TelnyxTelephonyProvider`: capabilities, Ed25519 signature verification.
- **Phone Number Lifecycle Tests (`PhoneNumberService`)**:
  - Provisioning and audit logging.
  - Transactional user assignment.
  - Unassignment back to pool.
  - Releasing numbers with active call protection.
  - Caller ID resolution precedence.
- **Routing Engine Tests (`TelephonyRoutingService`)**:
  - Inbound route resolution with priority ordering.
  - Rejection of unprovisioned / unknown DIDs.
- **Voicemail Tests (`VoicemailService`)**:
  - Creation linked to `CallSession` with `UNREAD` status.
  - IDOR protection against cross-user voicemail access.
- **Master Telephony Orchestration (`TelephonyService`)**:
  - Outbound PSTN call creation within unified `CallSession`/`CallLeg`.
  - Blocking emergency numbers with provider-dependent warning.
  - Idempotent webhook processing and duplicate event suppression.
  - DTMF transmission and realtime signaling broadcast.
- **Web Client Telephony Tests (`apps/web/src/test/telephony.spec.ts`)**:
  - TanStack query key determinism and isolation.
