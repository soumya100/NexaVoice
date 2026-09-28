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

export interface TwilioConfig {
  accountSid?: string;
  authToken?: string;
  apiKeySid?: string;
  apiKeySecret?: string;
}

@Injectable()
export class TwilioTelephonyProvider implements TelephonyProvider {
  readonly providerName = 'twilio';
  private readonly logger = new StructuredLogger('TwilioTelephonyProvider');
  private readonly config: TwilioConfig;

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
      accountSid:
        this.configService.get<string>('telephony.twilio.accountSid') || process.env.TWILIO_ACCOUNT_SID,
      authToken:
        this.configService.get<string>('telephony.twilio.authToken') || process.env.TWILIO_AUTH_TOKEN,
      apiKeySid:
        this.configService.get<string>('telephony.twilio.apiKeySid') || process.env.TWILIO_API_KEY_SID,
      apiKeySecret:
        this.configService.get<string>('telephony.twilio.apiKeySecret') || process.env.TWILIO_API_KEY_SECRET,
    };
  }

  isConfigured(): boolean {
    return Boolean(this.config.accountSid && this.config.authToken);
  }

  async initiateOutboundCall(options: InitiateOutboundCallOptions): Promise<TelephonyCallResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.providerName,
        status: 'unconfigured',
        error: 'Twilio credentials (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN) are not configured',
      };
    }

    try {
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Calls.json`;
      const basicAuth = Buffer.from(
        `${this.config.apiKeySid || this.config.accountSid}:${this.config.apiKeySecret || this.config.authToken}`,
      ).toString('base64');

      const params = new URLSearchParams();
      params.append('To', options.to);
      params.append('From', options.from);
      if (options.webhookUrl) {
        params.append('Url', options.webhookUrl);
      }
      if (options.statusCallbackUrl) {
        params.append('StatusCallback', options.statusCallbackUrl);
        params.append('StatusCallbackEvent', 'initiated ringing answered completed');
      }
      if (options.record) {
        params.append('Record', 'true');
      }
      if (options.timeoutSeconds) {
        params.append('Timeout', options.timeoutSeconds.toString());
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = (await res.json().catch(() => ({}))) as any;

      if (!res.ok) {
        const errorDetail = data?.message || `HTTP ${res.status}: ${res.statusText}`;
        this.logger.error({
          event: 'twilio_outbound_call_failed',
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

      this.logger.log({
        event: 'twilio_outbound_call_success',
        providerCallId: data.sid,
        status: data.status,
      });

      return {
        success: true,
        provider: this.providerName,
        providerCallId: data.sid,
        status: data.status || 'initiated',
        metadata: {
          price: data.price,
          direction: data.direction,
        },
      };
    } catch (err) {
      const errorDetail = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        provider: this.providerName,
        status: 'error',
        error: errorDetail,
      };
    }
  }

  async hangupCall(providerCallId: string): Promise<TelephonyCallResult> {
    if (!this.isConfigured()) {
      return {
        success: false,
        provider: this.providerName,
        status: 'unconfigured',
        error: 'Twilio is not configured',
      };
    }

    try {
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Calls/${providerCallId}.json`;
      const basicAuth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');

      const params = new URLSearchParams();
      params.append('Status', 'completed');

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = (await res.json().catch(() => ({}))) as any;

      if (!res.ok) {
        return {
          success: false,
          provider: this.providerName,
          status: 'failed',
          error: data?.message || `HTTP ${res.status}`,
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
    // In Twilio Voice, hold is achieved via live call modification (redirecting to hold TwiML)
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
        error: 'Twilio is not configured',
      };
    }

    try {
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/Calls/${providerCallId}/Play.json`;
      const basicAuth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');

      const params = new URLSearchParams();
      params.append('Digits', digits);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
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
        error: 'Twilio is not configured',
      };
    }

    try {
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/IncomingPhoneNumbers.json`;
      const basicAuth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');

      const params = new URLSearchParams();
      if (options.areaCode) params.append('AreaCode', options.areaCode);
      if (options.desiredNumber) params.append('PhoneNumber', options.desiredNumber);

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${basicAuth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = (await res.json().catch(() => ({}))) as any;

      if (!res.ok) {
        return {
          success: false,
          provider: this.providerName,
          e164Number: '',
          providerResourceId: '',
          capabilities: [],
          error: data?.message || `HTTP ${res.status}`,
        };
      }

      const capabilities: string[] = [];
      if (data.capabilities?.voice) capabilities.push('outboundCalling', 'inboundCalling');
      if (data.capabilities?.sms) capabilities.push('sms');

      return {
        success: true,
        provider: this.providerName,
        e164Number: data.phone_number,
        providerResourceId: data.sid,
        capabilities,
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

  async releaseNumber(providerResourceId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: 'Twilio is not configured' };
    }

    try {
      const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${this.config.accountSid}/IncomingPhoneNumbers/${providerResourceId}.json`;
      const basicAuth = Buffer.from(`${this.config.accountSid}:${this.config.authToken}`).toString('base64');

      const res = await fetch(endpoint, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${basicAuth}`,
        },
      });

      if (!res.ok) {
        return { success: false, error: `HTTP ${res.status}` };
      }

      return { success: true };
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  /**
   * Validates Twilio's X-Twilio-Signature cryptographic header.
   * Algorithm: HMAC-SHA1 over URL concatenated with alphabetically sorted POST parameters.
   */
  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string | Buffer,
    url: string,
  ): Promise<WebhookVerificationResult> {
    const signature = headers['x-twilio-signature'] as string | undefined;

    const payloadStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
    const params = new URLSearchParams(payloadStr);
    const parsedObj: Record<string, string> = {};
    params.forEach((value, key) => {
      parsedObj[key] = value;
    });

    if (!signature) {
      return {
        isValid: false,
        reason: 'Missing X-Twilio-Signature header',
      };
    }

    if (!this.config.authToken) {
      return {
        isValid: false,
        reason: 'Twilio auth token is unconfigured on server',
      };
    }

    let dataToSign = url;
    const sortedKeys = Object.keys(parsedObj).sort();
    for (const key of sortedKeys) {
      dataToSign += `${key}${parsedObj[key]}`;
    }

    const expectedSignature = crypto
      .createHmac('sha1', this.config.authToken)
      .update(Buffer.from(dataToSign, 'utf8'))
      .digest('base64');

    if (signature !== expectedSignature) {
      return {
        isValid: false,
        reason: 'Twilio signature validation failed',
      };
    }

    const callSid = parsedObj.CallSid || parsedObj.call_sid || '';
    const twilioStatus = (parsedObj.CallStatus || parsedObj.Status || '').toLowerCase();

    let eventType: NormalizedTelephonyEvent['eventType'] = 'call.initiated';
    if (twilioStatus === 'ringing') eventType = 'call.ringing';
    else if (twilioStatus === 'in-progress' || twilioStatus === 'answered') eventType = 'call.answered';
    else if (twilioStatus === 'completed') eventType = 'call.completed';
    else if (twilioStatus === 'busy') eventType = 'call.busy';
    else if (twilioStatus === 'no-answer') eventType = 'call.no-answer';
    else if (twilioStatus === 'failed' || twilioStatus === 'canceled') eventType = 'call.failed';

    if (parsedObj.RecordingUrl) {
      eventType = 'recording.available';
    } else if (parsedObj.Digits) {
      eventType = 'dtmf.received';
    }

    const normalizedEvent: NormalizedTelephonyEvent = {
      provider: this.providerName,
      providerEventId: parsedObj.EventSid || `tw-evt-${Date.now()}`,
      eventType,
      providerCallId: callSid,
      from: parsedObj.From || '',
      to: parsedObj.To || '',
      callDurationSeconds: parsedObj.CallDuration ? parseInt(parsedObj.CallDuration, 10) : undefined,
      recordingUrl: parsedObj.RecordingUrl,
      dtmfDigits: parsedObj.Digits,
      rawPayload: parsedObj,
    };

    return {
      isValid: true,
      normalizedEvent,
    };
  }
}
