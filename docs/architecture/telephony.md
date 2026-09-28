# NexaVoice Telephony Architecture

## Overview

Milestone 6 introduces carrier-grade PSTN (Public Switched Telephone Network) and SIP (Session Initiation Protocol) telephony to NexaVoice. 
A core first principle of this architecture is that **PSTN calls do not create a parallel calling subsystem**. Instead, telephone calls are integrated directly into the unified `CallSession`, `CallLeg`, and `CallParticipant` domain model established in Milestone 4 and Milestone 5.

```
                    ┌─────────────────────────┐
                    │       CallSession       │
                    │      (Unified Root)     │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
   ┌───────────┐           ┌───────────┐           ┌───────────┐
   │  CallLeg  │           │  CallLeg  │           │  CallLeg  │
   │  (WebRTC) │           │   (SIP)   │           │  (PSTN)   │
   └───────────┘           └───────────┘           └───────────┘
         │                       │                       │
         ▼                       ▼                       ▼
    WebRTC Client            SIP Trunk             Carrier Gateway
    (Browser / App)       (Private PBX)           (Twilio / Telnyx)
```

## Key Architectural Principles

1. **Unified Call Domain**: All calls share the same state machine (`INITIATING` -> `RINGING` -> `ACTIVE` -> `TERMINATED`), outbox events, correlation IDs, and participant controls.
2. **Provider Independence**: A vendor-neutral `TelephonyProvider` abstraction decouples NexaVoice business logic from carrier-specific REST APIs (Twilio, Telnyx, FreeSWITCH, Asterisk).
3. **Canonical E.164 Number Representation**: All telephone numbers crossing system boundaries are strictly normalized into ITU-T E.164 (`+` followed by country code and national digits).
4. **Zero Client Secrets**: No carrier tokens, SIP passwords, or webhook signing keys are ever delivered to the browser.
5. **No Parallel Billing Subsystem**: Telephony usage is durably tracked via `TelephonyUsage` records for future billing consumption, with strict exclusion of payment processors or invoices in Milestone 6.
6. **Multi-Carrier Webhook Ingestion**: Webhooks arrive at `/api/v1/telephony/webhooks/:provider`, undergo raw-body cryptographic signature verification, and are reconciled idempotently via `ProviderEvent`.

## Subsystem Components

- **TelephonyService**: Master orchestrator for outbound calls, inbound webhook processing, DTMF signaling, and usage tracking.
- **PhoneNumberService**: Full state-machine lifecycle (`SEARCHING` -> `RESERVED` -> `PROVISIONING` -> `ACTIVE` -> `ASSIGNED` -> `SUSPENDED` -> `RELEASING` -> `RELEASED`), transactional assignment to users/rooms/teams, release checks (preventing release during active calls), and caller ID resolution.
- **PhoneNumberNormalizerService**: E.164 parsing, international calling codes, emergency number detection, toll-free detection, and high-risk premium number identification.
- **TollFraudProtectionService**: Multi-tenant security layer enforcing per-minute rate limits, concurrent PSTN call limits, country destination policies, and high-risk destination blocking.
- **TelephonyRoutingService**: Deterministic, priority-ordered inbound DID routing with business hours evaluation and fallback chaining (User -> Voicemail, Team -> Voicemail, Reject).
- **VoicemailService**: Integrates directly with Milestone 5 `RecordingSession` architecture, providing IDOR-safe voicemail retrieval, transcription storage, and read/unread tracking.
