import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EmailDeliveryResult,
  EmailProvider,
  SendEmailOptions,
} from './email-provider.interface';
import { DevelopmentEmailProvider } from './providers/development-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { SendGridEmailProvider } from './providers/sendgrid-email.provider';
import { AwsSesEmailProvider } from './providers/aws-ses-email.provider';
import { EmailTemplateService } from './templates/email-template.service';
import { SecurityAuditService } from '../security/security-audit.service';
import { StructuredLogger } from '../../infrastructure/observability/structured-logger.service';

export interface SendPasswordResetEmailParams {
  to: string;
  displayName?: string;
  resetToken: string;
  ipAddress?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new StructuredLogger('EmailService');
  private readonly defaultFrom: string;
  private readonly frontendUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly devProvider: DevelopmentEmailProvider,
    private readonly resendProvider: ResendEmailProvider,
    private readonly sendgridProvider: SendGridEmailProvider,
    private readonly awsSesProvider: AwsSesEmailProvider,
    private readonly templateService: EmailTemplateService,
    private readonly securityAudit: SecurityAuditService,
  ) {
    this.defaultFrom = this.configService.get<string>(
      'email.from',
      'NexaVoice Security <security@nexavoice.io>',
    );
    this.frontendUrl = this.configService.get<string>(
      'email.frontendUrl',
      'http://localhost:3000',
    );
  }

  /**
   * Resolves the active provider dynamically according to configuration and available credentials.
   */
  getActiveProvider(): EmailProvider {
    const configuredProvider = this.configService.get<string>('email.provider', 'development');

    if (configuredProvider === 'resend' || (!configuredProvider && this.resendProvider.isConfigured())) {
      if (this.resendProvider.isConfigured()) {
        return this.resendProvider;
      }
    }

    if (configuredProvider === 'sendgrid' || (!configuredProvider && this.sendgridProvider.isConfigured())) {
      if (this.sendgridProvider.isConfigured()) {
        return this.sendgridProvider;
      }
    }

    if (
      configuredProvider === 'aws-ses' ||
      configuredProvider === 'ses' ||
      (!configuredProvider && this.awsSesProvider.isConfigured())
    ) {
      if (this.awsSesProvider.isConfigured()) {
        return this.awsSesProvider;
      }
    }

    // Default development fallback
    return this.devProvider;
  }

  /**
   * Sends a branded transactional password reset email to a user.
   */
  async sendPasswordResetEmail(
    params: SendPasswordResetEmailParams,
  ): Promise<EmailDeliveryResult> {
    const { to, displayName, resetToken, ipAddress } = params;
    const provider = this.getActiveProvider();

    const resetUrl = `${this.frontendUrl}/auth/reset-password?token=${encodeURIComponent(resetToken)}`;

    const { subject, html, text } = this.templateService.renderPasswordResetEmail({
      recipientName: displayName,
      resetUrl,
      expiryMinutes: 60,
      ipAddress,
    });

    const result = await provider.send({
      to,
      from: this.defaultFrom,
      subject,
      html,
      text,
      tags: { category: 'password-reset' },
    });

    await this.securityAudit.logEvent({
      action: 'PASSWORD_RESET_EMAIL_DISPATCHED',
      result: result.success ? 'SUCCESS' : 'FAILURE',
      reason: result.error,
      ipAddress,
      metadata: {
        recipientEmail: to,
        provider: result.provider,
        messageId: result.messageId,
      },
    });

    this.logger.log({
      event: 'password_reset_email_result',
      recipient: to,
      provider: result.provider,
      success: result.success,
      messageId: result.messageId,
    });

    return result;
  }

  /**
   * Sends generic transactional email via active provider.
   */
  async sendEmail(options: SendEmailOptions): Promise<EmailDeliveryResult> {
    const provider = this.getActiveProvider();
    return provider.send({
      ...options,
      from: options.from || this.defaultFrom,
    });
  }

  getDevelopmentProvider(): DevelopmentEmailProvider {
    return this.devProvider;
  }
}
