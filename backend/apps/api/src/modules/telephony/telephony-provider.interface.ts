import { TelephonyProviderCapabilities } from '@nexavoice/domain-types';

export interface InitiateOutboundCallOptions {
  callId: string;
  to: string; // Canonical E.164 format
  from: string; // Validated Caller ID in E.164 format
  webhookUrl?: string;
  statusCallbackUrl?: string;
  record?: boolean;
  timeoutSeconds?: number;
}

export interface TelephonyCallResult {
  success: boolean;
  provider: string;
  providerCallId?: string;
  status: string;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface ProvisionNumberOptions {
  countryCode: string;
  type?: 'LOCAL' | 'MOBILE' | 'TOLL_FREE';
  areaCode?: string;
  desiredNumber?: string;
}

export interface ProvisionedNumberResult {
  success: boolean;
  provider: string;
  e164Number: string;
  providerResourceId: string;
  capabilities: string[];
  error?: string;
}

export interface NormalizedTelephonyEvent {
  provider: string;
  providerEventId: string;
  eventType:
    | 'call.initiated'
    | 'call.ringing'
    | 'call.answered'
    | 'call.completed'
    | 'call.failed'
    | 'call.busy'
    | 'call.no-answer'
    | 'recording.available'
    | 'dtmf.received';
  providerCallId: string;
  from: string;
  to: string;
  callDurationSeconds?: number;
  recordingUrl?: string;
  dtmfDigits?: string;
  rawPayload: Record<string, unknown>;
}

export interface WebhookVerificationResult {
  isValid: boolean;
  reason?: string;
  normalizedEvent?: NormalizedTelephonyEvent;
}

export interface TelephonyProvider {
  readonly providerName: string;
  readonly capabilities: TelephonyProviderCapabilities;

  initiateOutboundCall(options: InitiateOutboundCallOptions): Promise<TelephonyCallResult>;
  hangupCall(providerCallId: string): Promise<TelephonyCallResult>;
  holdCall(providerCallId: string): Promise<TelephonyCallResult>;
  resumeCall(providerCallId: string): Promise<TelephonyCallResult>;
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
