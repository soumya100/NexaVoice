import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import {
  EmailDeliveryResult,
  EmailProvider,
  SendEmailOptions,
} from '../email-provider.interface';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

@Injectable()
export class DevelopmentEmailProvider implements EmailProvider {
  readonly providerName = 'development';
  private readonly logger = new StructuredLogger('DevelopmentEmailProvider');
  private sentEmails: Array<SendEmailOptions & { messageId: string; sentAt: Date }> = [];

  async send(options: SendEmailOptions): Promise<EmailDeliveryResult> {
    const messageId = `dev-${randomUUID()}`;
    const timestamp = new Date();

    const recipientString = Array.isArray(options.to)
      ? options.to.map((r) => (typeof r === 'string' ? r : r.email)).join(', ')
      : typeof options.to === 'string'
      ? options.to
      : options.to.email;

    this.logger.log({
      event: 'email_dispatched_in_development_mode',
      provider: this.providerName,
      messageId,
      to: recipientString,
      subject: options.subject,
      timestamp: timestamp.toISOString(),
    });

    this.sentEmails.push({
      ...options,
      messageId,
      sentAt: timestamp,
    });

    return {
      success: true,
      messageId,
      provider: this.providerName,
      timestamp,
    };
  }

  getSentEmails() {
    return [...this.sentEmails];
  }

  getLastSentEmail() {
    return this.sentEmails[this.sentEmails.length - 1];
  }

  clearSentEmails() {
    this.sentEmails = [];
  }
}
