# ADR 007: Unified PSTN & SIP Telephony Architecture

## Status
Accepted

## Context
NexaVoice requires Public Switched Telephone Network (PSTN) calling, Direct Inward Dialing (DID) number management, SIP trunking, inbound routing, DTMF handling, and voicemail. A naive approach would build a standalone PSTN calling system separate from the WebRTC conferencing system built in Milestones 4 and 5.

## Decision
1. **Unified Call Domain**: All calls—regardless of whether media is transported via WebRTC, SIP, or PSTN—are modeled as call legs (`CallLeg`) attached to a root `CallSession`. The existing call state machine, transactional outbox, participant model, and audit logging remain the single source of truth.
2. **Telephony Provider Abstraction**: A standardized `TelephonyProvider` interface encapsulates carrier-specific REST APIs and webhooks. Real carriers (Twilio, Telnyx) and a deterministic `MockTelephonyProvider` implement this contract.
3. **Canonical E.164 Normalization**: Raw phone strings are normalized into ITU-T E.164 format across all database and API boundaries.
4. **Server-Side Secret Isolation**: Carrier tokens, SIP passwords, and webhook secrets are exclusively maintained server-side and never exposed to the frontend client.
5. **No Billing in Milestone 6**: Non-billing usage records (`TelephonyUsage`) capture call duration, direction, and provider references for future invoicing milestones without introducing payment processors prematurely.

## Consequences
- **Positive**: Single unified state machine for both WebRTC and telephony calls; easy bridging between WebRTC participants and PSTN callers; vendor neutrality; robust toll-fraud protection.
- **Trade-offs**: Real PSTN termination and regulatory E911 require external carrier subscriptions and certified PSAP address registration, classified as `🟣 PROVIDER-DEPENDENT`.
