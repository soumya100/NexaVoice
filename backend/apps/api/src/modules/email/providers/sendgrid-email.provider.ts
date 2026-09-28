import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailDeliveryResult,
  EmailProvider,
  SendEmailOptions,
} from '../email-provider.interface';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

@Injectable()
export class SendGridEmailProvider implements EmailProvider {
  readonly providerName = 'sendgrid';
  private readonly logger = new StructuredLogger('SendGridEmailProvider');
  private readonly apiKey?: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey =
      this.configService.get<string>('email.sendgridApiKey') || process.env.SENDGRID_API_KEY;
  }

  isConfigured(): boolean {
    return Boolean(this.apiKey && this.apiKey.trim().length > 0);
  }

  async send(options: SendEmailOptions): Promise<EmailDeliveryResult> {
    const timestamp = new Date();

    if (!this.isConfigured()) {
      const errorMsg = 'SendGrid API key is not configured';
      this.logger.warn({
        event: 'sendgrid_delivery_skipped_missing_key',
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
        ? options.to.map((r) => (typeof r === 'string' ? { email: r } : { email: r.email, name: r.name }))
        : [typeof options.to === 'string' ? { email: options.to } : { email: options.to.email, name: options.to.name }];

      const fromAddress = options.from || 'security@nexavoice.io';
      // Match email from format "Name <email@...>" or plain email
      const fromMatch = fromAddress.match(/^(?:(.*?)<)?([^<>]+)>?$/);
      const fromEmail = fromMatch ? fromMatch[2].trim() : fromAddress;
      const fromName = fromMatch && fromMatch[1] ? fromMatch[1].trim() : 'NexaVoice Security';

      const payload = {
        personalizations: [{ to: recipients }],
        from: { email: fromEmail, name: fromName },
        subject: options.subject,
        content: [
          ...(options.text ? [{ type: 'text/plain', value: options.text }] : []),
          { type: 'text/html', value: options.html },
        ],
        ...(options.replyTo ? { reply_to: { email: options.replyTo } } : {}),
      };

      const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorBody = (await res.json().catch(() => ({}))) as any;
        const errorDetail = JSON.stringify(errorBody.errors || errorBody) || `HTTP ${res.status}`;
        this.logger.error({
          event: 'sendgrid_delivery_failed',
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

      const messageId = res.headers.get('x-message-id') || `sg-${Date.now()}`;
      this.logger.log({
        event: 'sendgrid_delivery_success',
        messageId,
      });

      return {
        success: true,
        messageId,
        provider: this.providerName,
        timestamp,
      };
    } catch (err) {
      const errorDetail = err instanceof Error ? err.message : String(err);
      this.logger.error({
        event: 'sendgrid_delivery_network_error',
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
