# NexaVoice Recording Compliance & Consent Security

## Regulatory Context & Dual-Party/All-Party Consent
Telecommunications laws in numerous jurisdictions (e.g. California, Germany, UK GDPR, Australia) require explicit consent from all parties participating in an audio or video call prior to recording.

## Security Controls
1. **Mandatory Explicit Consent**:
   - Starting a recording automatically provisions a `RecordingConsent` record for all currently connected participants.
   - Any participant joining mid-call while recording is active receives an immediate prompt.
2. **Textual Visual Accessibility**:
   - Every participant's UI receives a live state update that renders the text "RECORDING IN PROGRESS" or "RECORDING PAUSED". Color alone is strictly insufficient for compliance and accessibility.
3. **Consent Withdrawal & Action**:
   - If a participant declines or withdraws consent (`ConsentState.DENIED` or `ConsentState.WITHDRAWN`), their audio/video channel can be excluded from mixed media recording or the recording can be automatically paused according to organizational policy.
4. **Time-Limited Signed Access**:
   - Direct raw media paths are never exposed to clients.
   - Clients must request a time-limited (1-hour), HMAC-signed token URL via `getRecordingPlaybackUrl`.
   - Strict IDOR validation prevents non-participants from accessing recordings.
