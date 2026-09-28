# PSTN Calling Architecture

## Outbound PSTN Calling Flow

When an authenticated user initiates an outbound telephone call:

1. **Dialer & E.164 Normalization**: The user enters a destination number in the web client. `PhoneNumberNormalizerService` normalizes the input into canonical E.164 (e.g., `+14155552671`).
2. **Emergency Calling Gate**: If an emergency number (911, 112, 999, etc.) is detected, the call is blocked immediately with a `🟣 PROVIDER-DEPENDENT` exception, instructing the user that live E911 certified PSAP address registration is required.
3. **Toll-Fraud & Authorization Guard**:
   - Destination country is checked against the organization's allowed country list.
   - High-risk premium destinations (e.g., 900 numbers, satellite +870/+881) are blocked.
   - Per-minute call rate limits and per-user concurrent PSTN call limits are enforced.
4. **Caller ID Resolution**:
   - The user selects a provisioned DID or falls back to their assigned user DID.
   - If unassigned, the organization's verified default DID is resolved. Arbitrary client-spoofed caller IDs are rejected.
5. **CallSession & CallLeg Creation**:
   - A unified `CallSession` is created with `callType = CallType.PSTN`.
   - An outbound `CallLeg` is created with `direction = 'OUTBOUND'` and `status = 'RINGING'`.
6. **Carrier Provider Invocation**:
   - The active carrier adapter (`TwilioTelephonyProvider`, `TelnyxTelephonyProvider`, or `MockTelephonyProvider`) initiates the outbound REST call.
   - The external `providerCallId` is returned and mapped to the internal `CallSession`.
7. **Usage Tracking**: A `TelephonyUsage` record is created linking `callSessionId`, `provider`, `providerCallId`, `sourceNumber`, and `destinationNumber`.
8. **Realtime Signaling**: `signaling.gateway` broadcasts `call.ringing` to the host user.

## Inbound PSTN Calling Flow

When a telephone caller dials a provisioned DID:

1. **Carrier Webhook**: Carrier posts an event to `/api/v1/telephony/webhooks/:provider`.
2. **Signature Verification**: Carrier adapter cryptographically validates the raw request body using HMAC-SHA1 (Twilio) or Ed25519 (Telnyx).
3. **Idempotency Reconciliation**: The event ID is verified against the `ProviderEvent` database table. Duplicate webhooks are acknowledged without reprocessing.
4. **DID Resolution & Routing Policy**:
   - `TelephonyRoutingService.resolveInboundRoute(calledDid)` resolves the DID to its assigned routing policy.
   - If priority rules exist, business hours and fallback rules are evaluated.
5. **Session Transition**:
   - `CallStateMachineService` transitions the `CallSession` (`RINGING` -> `ACTIVE` -> `TERMINATED`).
   - If unanswered after the configured ring duration, the call cascades to `VoicemailService`.
6. **Realtime Notification**: The target user or room receives the incoming call modal in the web client.
