import { Injectable } from '@nestjs/common';
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

export interface MockCallRecord {
  callId: string;
  providerCallId: string;
  to: string;
  from: string;
  status: 'initiated' | 'ringing' | 'answered' | 'held' | 'completed' | 'failed';
  dtmfLog: string[];
  createdAt: Date;
}

@Injectable()
export class MockTelephonyProvider implements TelephonyProvider {
  readonly providerName = 'mock';
  private readonly logger = new StructuredLogger('MockTelephonyProvider');

  readonly capabilities: TelephonyProviderCapabilities = {
    outboundCalling: true,
    inboundCalling: true,
    sipTrunking: true,
    numberProvisioning: true,
    numberPorting: false,
    recording: true,
    transcription: true,
    dtmf: true,
    transfer: true,
    emergencyCalling: false,
    statusCallbacks: true,
  };

  private activeCalls = new Map<string, MockCallRecord>();
  private provisionedNumbers = new Map<string, { e164Number: string; capabilities: string[] }>();

  async initiateOutboundCall(options: InitiateOutboundCallOptions): Promise<TelephonyCallResult> {
    const providerCallId = `mock-call-${crypto.randomUUID()}`;
    const record: MockCallRecord = {
      callId: options.callId,
      providerCallId,
      to: options.to,
      from: options.from,
      status: 'initiated',
      dtmfLog: [],
      createdAt: new Date(),
    };

    this.activeCalls.set(providerCallId, record);

    this.logger.log({
      event: 'mock_outbound_call_initiated',
      callId: options.callId,
      providerCallId,
      to: options.to,
      from: options.from,
    });

    return {
      success: true,
      provider: this.providerName,
      providerCallId,
      status: 'initiated',
    };
  }

  async hangupCall(providerCallId: string): Promise<TelephonyCallResult> {
    const record = this.activeCalls.get(providerCallId);
    if (!record) {
      return {
        success: false,
        provider: this.providerName,
        status: 'not_found',
        error: `Call ${providerCallId} not found in mock provider`,
      };
    }

    record.status = 'completed';
    this.logger.log({
      event: 'mock_call_hung_up',
      providerCallId,
    });

    return {
      success: true,
      provider: this.providerName,
      providerCallId,
      status: 'completed',
    };
  }

  async holdCall(providerCallId: string): Promise<TelephonyCallResult> {
    const record = this.activeCalls.get(providerCallId);
    if (!record) {
      return {
        success: false,
        provider: this.providerName,
        status: 'not_found',
        error: `Call ${providerCallId} not found`,
      };
    }

    record.status = 'held';
    return {
      success: true,
      provider: this.providerName,
      providerCallId,
      status: 'held',
    };
  }

  async resumeCall(providerCallId: string): Promise<TelephonyCallResult> {
    const record = this.activeCalls.get(providerCallId);
    if (!record) {
      return {
        success: false,
        provider: this.providerName,
        status: 'not_found',
        error: `Call ${providerCallId} not found`,
      };
    }

    record.status = 'answered';
    return {
      success: true,
      provider: this.providerName,
      providerCallId,
      status: 'answered',
    };
  }

  async sendDtmf(providerCallId: string, digits: string): Promise<TelephonyCallResult> {
    const record = this.activeCalls.get(providerCallId);
    if (!record) {
      return {
        success: false,
        provider: this.providerName,
        status: 'not_found',
        error: `Call ${providerCallId} not found`,
      };
    }

    record.dtmfLog.push(digits);
    this.logger.log({
      event: 'mock_dtmf_sent',
      providerCallId,
      digits,
    });

    return {
      success: true,
      provider: this.providerName,
      providerCallId,
      status: 'dtmf_sent',
      metadata: { digits },
    };
  }

  async transferCall(providerCallId: string, targetNumber: string): Promise<TelephonyCallResult> {
    const record = this.activeCalls.get(providerCallId);
    if (!record) {
      return {
        success: false,
        provider: this.providerName,
        status: 'not_found',
        error: `Call ${providerCallId} not found`,
      };
    }

    this.logger.log({
      event: 'mock_call_transferred',
      providerCallId,
      targetNumber,
    });

    return {
      success: true,
      provider: this.providerName,
      providerCallId,
      status: 'transferred',
      metadata: { targetNumber },
    };
  }

  async provisionNumber(options: ProvisionNumberOptions): Promise<ProvisionedNumberResult> {
    const providerResourceId = `mock-num-${crypto.randomUUID()}`;
    const e164Number =
      options.desiredNumber ||
      `+1${options.areaCode || '415'}555${Math.floor(1000 + Math.random() * 9000)}`;

    const capabilities = ['outboundCalling', 'inboundCalling', 'dtmf', 'recording'];
    this.provisionedNumbers.set(providerResourceId, { e164Number, capabilities });

    this.logger.log({
      event: 'mock_number_provisioned',
      providerResourceId,
      e164Number,
    });

    return {
      success: true,
      provider: this.providerName,
      e164Number,
      providerResourceId,
      capabilities,
    };
  }

  async releaseNumber(providerResourceId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.provisionedNumbers.has(providerResourceId)) {
      return {
        success: false,
        error: `Number resource ${providerResourceId} not found in mock provider`,
      };
    }

    this.provisionedNumbers.delete(providerResourceId);
    this.logger.log({
      event: 'mock_number_released',
      providerResourceId,
    });

    return { success: true };
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: string | Buffer,
    _url: string,
  ): Promise<WebhookVerificationResult> {
    const secretHeader = headers['x-mock-telephony-secret'];
    if (secretHeader && secretHeader !== 'valid-mock-secret') {
      return {
        isValid: false,
        reason: 'Invalid mock webhook secret',
      };
    }

    try {
      const payloadStr = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
      const body = JSON.parse(payloadStr || '{}');

      const normalizedEvent: NormalizedTelephonyEvent = {
        provider: this.providerName,
        providerEventId: body.eventId || `mock-evt-${crypto.randomUUID()}`,
        eventType: body.eventType || 'call.ringing',
        providerCallId: body.providerCallId || 'mock-call-sample',
        from: body.from || '+14155550100',
        to: body.to || '+14155550200',
        callDurationSeconds: body.duration,
        recordingUrl: body.recordingUrl,
        dtmfDigits: body.dtmfDigits,
        rawPayload: body,
      };

      return {
        isValid: true,
        normalizedEvent,
      };
    } catch (err) {
      return {
        isValid: false,
        reason: `Failed to parse mock webhook payload: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  getCallRecord(providerCallId: string): MockCallRecord | undefined {
    return this.activeCalls.get(providerCallId);
  }

  clear(): void {
    this.activeCalls.clear();
    this.provisionedNumbers.clear();
  }
}
