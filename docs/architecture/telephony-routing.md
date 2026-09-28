# Inbound Telephony Routing Engine

## Inbound Routing Model

When an incoming PSTN or SIP call reaches a provisioned DID, `TelephonyRoutingService` evaluates routing policies deterministically:

1. **DID Lookup**: Query `PhoneNumber` by `e164Number`. If the number does not exist or is not `ACTIVE`/`ASSIGNED`, return target `REJECT`.
2. **Custom Policy Resolution**:
   - Query `RoutingRule` records ordered by `priority ASC`.
   - Evaluate **Business Hours**: If enabled, inspect current time within configured start/end window in the rule's timezone.
   - If outside business hours, immediately cascade to `fallbackTargetType` (e.g., `VOICEMAIL`).
3. **Direct Assignment Fallback**:
   - If no custom routing rules match, inspect `phoneNumber.assignedToType`:
     - `USER`: Route directly to user's active client sessions.
     - `ROOM`: Route into persistent conference room.
     - `TEAM`: Ring team group members.
     - `ORGANIZATION`: Route to organization main operator.
4. **No-Answer Timeout & Voicemail**:
   - If ringing exceeds `ringDurationSeconds`, call automatically falls back to `VoicemailService`.
