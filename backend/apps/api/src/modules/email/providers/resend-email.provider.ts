import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailDeliveryResult,
  EmailProvider,
  SendEmailOptions,
} from '../email-provider.interface';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

@Injectable()
export class ResendEmailProvider implements EmailProvider {
  readonly providerName = 'resend';
  private readonly logger = new StructuredLogger('ResendEmailProvider');
  private readonly apiKey?: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('email.resendApiKey') || process.env.RESEND_API_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async send(options: SendEmailOptions): Promise<EmailDeliveryResult> {
    const timestamp = new Date();

    if (!this.isConfigured()) {
      const errorMsg = 'Resend API key is not configured';
      this.logger.warn({
        event: 'resend_delivery_skipped_missing_key',
        error: errorMsg,
      });
      return {
        success: false,
        provider: this.providerName,
        error: errorMsg,
        timestamp,
      };
    }

    try {
      const recipients = Array.isArray(options.to)
        ? options.to.map((r) => (typeof r === 'string' ? r : `${r.name ? `${r.name} <${r.email}>` : r.email}`))
        : [typeof options.to === 'string' ? options.to : options.to.name ? `${options.to.name} <${options.to.email}>` : options.to.email];

      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: options.from || 'NexaVoice Security <security@nexavoice.io>',
          to: recipients,
          subject: options.subject,
          html: options.html,
          text: options.text,
          reply_to: options.replyTo,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as any;

      if (!res.ok) {
        const errorDetail = data?.message || data?.error || `HTTP ${res.status}: ${res.statusText}`;
        this.logger.error({
          event: 'resend_delivery_failed',
          statusCode: res.status,
          error: errorDetail,
        });
        return {
          success: false,
          provider: this.providerName,
          error: errorDetail,
          timestamp,
        };
      }

      this.logger.log({
        event: 'resend_delivery_success',
        messageId: data.id,
      });

      return {
        success: true,
        messageId: data.id,
        provider: this.providerName,
        timestamp,
      };
    } catch (err) {
      const errorDetail = err instanceof Error ? err.message : String(err);
      this.logger.error({
        event: 'resend_delivery_network_error',
        error: errorDetail,
      });
      return {
        success: false,
        provider: this.providerName,
        error: errorDetail,
        timestamp,
      };
    }
  }
}
