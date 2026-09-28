# Telephony Provider Abstraction

## Overview

The `TelephonyProvider` interface isolates carrier-specific REST and signaling APIs behind a normalized contract:

```typescript
export interface TelephonyProvider {
  readonly providerName: string;
  readonly capabilities: TelephonyProviderCapabilities;

  initiateOutboundCall(options: InitiateOutboundCallOptions): Promise<TelephonyCallResult>;
  hangupCall(providerCallId: string): Promise<TelephonyCallResult>;
  sendDtmf(providerCallId: string, digits: string): Promise<TelephonyCallResult>;
  transferCall(providerCallId: string, targetNumber: string): Promise<TelephonyCallResult>;
  provisionNumber(options: ProvisionNumberOptions): Promise<ProvisionedNumberResult>;
  releaseNumber(providerResourceId: string): Promise<{ success: boolean; error?: string }>;
  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string | Buffer,
    url: string,
  ): Promise<WebhookVerificationResult>;
}
```

## Provider Adapters Implemented

1. **`MockTelephonyProvider` (`🟠 MOCK / TEST DOUBLE`)**:
   - In-memory deterministic provider for automated unit, integration, and E2E testing without external network dependencies.
   - Generates simulated carrier call IDs and DIDs.
2. **`TwilioTelephonyProvider` (`🟣 PROVIDER-DEPENDENT`)**:
   - Integrates with Twilio Programmable Voice REST API and IncomingPhoneNumbers API.
   - Validates `X-Twilio-Signature` using HMAC-SHA1 over URL and sorted POST parameters.
3. **`TelnyxTelephonyProvider` (`🟣 PROVIDER-DEPENDENT`)**:
   - Integrates with Telnyx Call Control v2 and Number Order APIs.
   - Validates `telnyx-signature-ed25519` and `telnyx-timestamp` headers using public key cryptography.

## Provider Capabilities

Each adapter declares explicit capabilities:
- `outboundCalling`
- `inboundCalling`
- `sipTrunking`
- `numberProvisioning`
- `numberPorting`
- `recording`
- `transcription`
- `dtmf`
- `transfer`
- `emergencyCalling`
- `statusCallbacks`

The application validates provider capability before dispatching operations.
