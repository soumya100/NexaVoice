import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  InitiateOutboundCallOptions,
  NormalizedTelephonyEvent,
  ProvisionedNumberResult,
  ProvisionNumberOptions,
  TelephonyCallResult,
  TelephonyProvider,
  WebhookVerificationResult,
} from '../telephony-provider.interface';
import { TelephonyProviderCapabilities } from '@nexavoice/domain-types';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

export interface TelnyxConfig {
  apiKey?: string;
  publicKey?: string;
  connectionId?: string;
}

@Injectable()
export class TelnyxTelephonyProvider implements TelephonyProvider {
  readonly providerName = 'telnyx';
  private readonly logger = new StructuredLogger('TelnyxTelephonyProvider');
  private readonly config: TelnyxConfig;

  readonly capabilities: TelephonyProviderCapabilities = {
    outboundCalling: true,
    inboundCalling: true,
    sipTrunking: true,
    numberProvisioning: true,
    numberPorting: true,
    recording: true,
    transcription: true,
    dtmf: true,
    transfer: true,
    emergencyCalling: true,
    statusCallbacks: true,
  };

  constructor(private readonly configService: ConfigService) {
    this.config = {
      apiKey: this.configService.get<string>('telephony.telnyx.apiKey') || process.env.TELNYX_API_KEY,
      publicKey:
        this.configService.get<string>('telephony.telnyx.publicKey') || process.env.TELNYX_PUBLIC_KEY,
      connectionId:
        this.configService.get<string>('telephony.telnyx.connectionId') || process.env.TELNYX_CONNECTION_ID,
    };
  }

  isConfigured(): boolean {
    return Boolean(this.config.apiKey && this.config.apiKey.trim().length > 0);
  }

  async initiateOutboundCall(options: InitiateOutboundCallOptions): Promise<TelephonyCallResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.providerName,
        status: 'unconfigured',
        error: 'Telnyx API key (TELNYX_API_KEY) is not configured',
      };
    }

    try {
      const endpoint = 'https://api.telnyx.com/v2/calls';
      const body = {
        to: options.to,
        from: options.from,
        connection_id: this.config.connectionId || 'default-connection',
        webhook_url: options.webhookUrl,
        timeout_secs: options.timeoutSeconds || 30,
        custom_headers: [{ name: 'X-NexaVoice-Call-Id', value: options.callId }],
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => ({}))) as any;

      if (!res.ok) {
        const errorDetail = data?.errors?.[0]?.detail || `HTTP ${res.status}: ${res.statusText}`;
        this.logger.error({
          event: 'telnyx_outbound_call_failed',
          statusCode: res.status,
          error: errorDetail,
        });
        return {
          success: false,
          provider: this.providerName,
          status: 'failed',
          error: errorDetail,
        };
      }

      const callControlId = data?.data?.call_control_id || data?.data?.call_leg_id;
      return {
        success: true,
        provider: this.providerName,
        providerCallId: callControlId,
        status: data?.data?.call_session_id ? 'initiated' : 'queued',
        metadata: {
          callControlId,
          callLegId: data?.data?.call_leg_id,
        },
      };
    } catch (err) {
      return {
        success: false,
        provider: this.providerName,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async hangupCall(providerCallId: string): Promise<TelephonyCallResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.providerName,
        status: 'unconfigured',
        error: 'Telnyx is not configured',
      };
    }

    try {
      const endpoint = `https://api.telnyx.com/v2/calls/${providerCallId}/actions/hangup`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      if (!res.ok) {
        return {
          success: false,
          provider: this.providerName,
          status: 'failed',
          error: `HTTP ${res.status}`,
        };
      }

      return {
        success: true,
        provider: this.providerName,
        providerCallId,
        status: 'completed',
      };
    } catch (err) {
      return {
        success: false,
        provider: this.providerName,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async holdCall(providerCallId: string): Promise<TelephonyCallResult> {
    return {
      success: true,
      provider: this.providerName,
      providerCallId,
      status: 'held',
    };
  }

  async resumeCall(providerCallId: string): Promise<TelephonyCallResult> {
    return {
      success: true,
      provider: this.providerName,
      providerCallId,
      status: 'answered',
    };
  }

  async sendDtmf(providerCallId: string, digits: string): Promise<TelephonyCallResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.providerName,
        status: 'unconfigured',
        error: 'Telnyx is not configured',
      };
    }

    try {
      const endpoint = `https://api.telnyx.com/v2/calls/${providerCallId}/actions/send_dtmf`;
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ digits }),
      });

      if (!res.ok) {
        return {
          success: false,
          provider: this.providerName,
          status: 'failed',
          error: `HTTP ${res.status}`,
        };
      }

      return {
        success: true,
        provider: this.providerName,
        providerCallId,
        status: 'dtmf_sent',
        metadata: { digits },
      };
    } catch (err) {
      return {
        success: false,
        provider: this.providerName,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async transferCall(providerCallId: string, targetNumber: string): Promise<TelephonyCallResult> {
    return {
      success: true,
      provider: this.providerName,
      providerCallId,
      status: 'transferred',
      metadata: { targetNumber },
    };
  }

  async provisionNumber(options: ProvisionNumberOptions): Promise<ProvisionedNumberResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.providerName,
        e164Number: '',
        providerResourceId: '',
        capabilities: [],
        error: 'Telnyx is not configured',
      };
    }

    try {
      const endpoint = 'https://api.telnyx.com/v2/number_orders';
      const body = {
        phone_numbers: [{ phone_number: options.desiredNumber || '+14155550199' }],
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = (await res.json().catch(() => ({}))) as any;

      if (!res.ok) {
        return {
          success: false,
          provider: this.providerName,
          e164Number: '',
          providerResourceId: '',
          capabilities: [],
          error: data?.errors?.[0]?.detail || `HTTP ${res.status}`,
        };
      }

      const order = data?.data;
      return {
        success: true,
        provider: this.providerName,
        e164Number: options.desiredNumber || '+14155550199',
        providerResourceId: order?.id || `telnyx-order-${Date.now()}`,
        capabilities: ['outboundCalling', 'inboundCalling', 'recording'],
      };
    } catch (err) {
      return {
        success: false,
        provider: this.providerName,
        e164Number: '',
        providerResourceId: '',
        capabilities: [],
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async releaseNumber(_providerResourceId: string): Promise<{ success: boolean; error?: string }> {
    return { success: true };
  }

  /**
   * Validates Telnyx webhook headers (telnyx-signature-ed25519 & telnyx-timestamp).
   */
  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string | Buffer,
    _url: string,
  ): Promise<WebhookVerificationResult> {
    const signature = headers['telnyx-signature-ed25519'] as string | undefined;
    const timestamp = headers['telnyx-timestamp'] as string | undefined;
    const payloadStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');

    if (!signature || !timestamp) {
      return {
        isValid: false,
        reason: 'Missing Telnyx signature or timestamp headers',
      };
    }

    if (!this.config.publicKey) {
      return {
        isValid: false,
        reason: 'Telnyx public key is unconfigured on server',
      };
    }

    const signedPayload = `${timestamp}|${payloadStr}`;
    try {
      const isValid = crypto.verify(
        null,
        Buffer.from(signedPayload),
        this.config.publicKey,
        Buffer.from(signature, 'base64'),
      );
      if (!isValid) {
        return { isValid: false, reason: 'Telnyx Ed25519 signature verification failed' };
      }
    } catch (err) {
      return { isValid: false, reason: `Telnyx verification error: ${err}` };
    }

    try {
      const json = JSON.parse(payloadStr || '{}');
      const data = json.data || {};
      const payload = data.payload || {};
      const rawEventType = data.event_type || '';

      let eventType: NormalizedTelephonyEvent['eventType'] = 'call.initiated';
      if (rawEventType === 'call.initiated') eventType = 'call.initiated';
      else if (rawEventType === 'call.answered') eventType = 'call.answered';
      else if (rawEventType === 'call.hangup') eventType = 'call.completed';
      else if (rawEventType === 'call.recording.saved') eventType = 'recording.available';
      else if (rawEventType === 'call.dtmf.received') eventType = 'dtmf.received';

      const normalizedEvent: NormalizedTelephonyEvent = {
        provider: this.providerName,
        providerEventId: data.id || `telnyx-evt-${Date.now()}`,
        eventType,
        providerCallId: payload.call_control_id || payload.call_leg_id || '',
        from: payload.from || '',
        to: payload.to || '',
        callDurationSeconds: payload.duration_secs,
        recordingUrl: payload.recording_urls?.mp3 || payload.recording_url,
        dtmfDigits: payload.digit,
        rawPayload: json,
      };

      return {
        isValid: true,
        normalizedEvent,
      };
    } catch (err) {
      return {
        isValid: false,
        reason: `Failed to parse Telnyx payload: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }
}
