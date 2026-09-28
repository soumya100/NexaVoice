# Telephony Security & Toll-Fraud Controls

## Toll-Fraud Defense Architecture

PSTN calling introduces severe financial and security liabilities (IRS/revenue-share fraud, high-cost international loops, PBX hacking). NexaVoice implements defense-in-depth:

1. **High-Risk Destination Blocking**:
   - Destination numbers starting with US 900 premium prefixes or international satellite codes (`+870`, `+881`, `+882`, `+883`) are blocked at the normalizer and fraud protection layer.
2. **Organization Country Whitelist**:
   - Outbound calling is restricted to authorized countries (default: `['US', 'CA', 'GB', 'IN', 'AU', 'DE', 'FR']`). Destination countries outside this list are rejected with `ForbiddenException`.
3. **Rate Limiting & Concurrent Call Caps**:
   - Maximum outbound calls per minute per user/organization (default: 5 calls/minute).
   - Maximum concurrent active PSTN legs per user (default: 2 simultaneous calls).
4. **Caller ID Spoofing Prevention**:
   - Users cannot pass arbitrary caller ID strings.
   - Outbound caller ID must match an active provisioned DID assigned to the user or organization.

## Webhook Security & Idempotency

- Webhook endpoints (`/api/v1/telephony/webhooks/:provider`) require raw-body cryptographic signature verification.
- Replayed or unauthenticated webhooks return HTTP 401 Unauthorized.
- Validated webhooks record their `providerEventId` in the `ProviderEvent` database table with a unique constraint. Duplicate deliveries are recognized and acknowledged without duplicate side effects.

## IDOR Protection

- Voicemail messages (`VoicemailMessage`) enforce recipient ownership: users can only view, mark as read, or delete voicemails addressed to their user ID or authorized role.
- Phone number assignments and routing rules require organization administrative permissions (`TELEPHONY_NUMBER_ASSIGN`, `TELEPHONY_ROUTING_MANAGE`).
