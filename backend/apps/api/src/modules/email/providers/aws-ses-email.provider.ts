import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import {
  EmailDeliveryResult,
  EmailProvider,
  SendEmailOptions,
} from '../email-provider.interface';
import { StructuredLogger } from '../../../infrastructure/observability/structured-logger.service';

export interface AwsSesConfig {
  region: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
}

@Injectable()
export class AwsSesEmailProvider implements EmailProvider {
  readonly providerName = 'aws-ses';
  private readonly logger = new StructuredLogger('AwsSesEmailProvider');
  private readonly config: AwsSesConfig;

  constructor(private readonly configService: ConfigService) {
    this.config = {
      region:
        this.configService.get<string>('email.awsSes.region') ||
        process.env.AWS_SES_REGION ||
        process.env.AWS_REGION ||
        'us-east-1',
      accessKeyId:
        this.configService.get<string>('email.awsSes.accessKeyId') ||
        process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey:
        this.configService.get<string>('email.awsSes.secretAccessKey') ||
        process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken:
        this.configService.get<string>('email.awsSes.sessionToken') ||
        process.env.AWS_SESSION_TOKEN,
    };
  }

  isConfigured(): boolean {
    return Boolean(
      this.config.accessKeyId &&
        this.config.accessKeyId.trim().length > 0 &&
        this.config.secretAccessKey &&
        this.config.secretAccessKey.trim().length > 0,
    );
  }

  async send(options: SendEmailOptions): Promise<EmailDeliveryResult> {
    const timestamp = new Date();

    if (!this.isConfigured()) {
      const errorMsg = 'AWS SES credentials (accessKeyId/secretAccessKey) are not configured';
      this.logger.warn({
        event: 'aws_ses_delivery_skipped_missing_credentials',
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
      const toAddresses = (Array.isArray(options.to) ? options.to : [options.to]).map((r) =>
        typeof r === 'string' ? r : r.email,
      );

      const payload = {
        FromEmailAddress: options.from || 'NexaVoice Security <security@nexavoice.io>',
        Destination: {
          ToAddresses: toAddresses,
        },
        Content: {
          Simple: {
            Subject: {
              Data: options.subject,
              Charset: 'UTF-8',
            },
            Body: {
              Html: {
                Data: options.html,
                Charset: 'UTF-8',
              },
              ...(options.text
                ? {
                    Text: {
                      Data: options.text,
                      Charset: 'UTF-8',
                    },
                  }
                : {}),
            },
          },
        },
        ...(options.replyTo ? { ReplyToAddresses: [options.replyTo] } : {}),
      };

      const body = JSON.stringify(payload);
      const host = `email.${this.config.region}.amazonaws.com`;
      const endpoint = `https://${host}/v2/email/outbound-emails`;
      const now = new Date();
      const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
      const dateStamp = amzDate.slice(0, 8);

      const headers: Record<string, string> = {
        'content-type': 'application/json',
        host,
        'x-amz-date': amzDate,
      };

      if (this.config.sessionToken) {
        headers['x-amz-security-token'] = this.config.sessionToken;
      }

      const signedHeaders = Object.keys(headers).sort().join(';');
      const canonicalHeaders = Object.keys(headers)
        .sort()
        .map((k) => `${k}:${headers[k]}\n`)
        .join('');

      const payloadHash = crypto.createHash('sha256').update(body, 'utf8').digest('hex');

      const canonicalRequest = [
        'POST',
        '/v2/email/outbound-emails',
        '', // canonical query
        canonicalHeaders,
        signedHeaders,
        payloadHash,
      ].join('\n');

      const credentialScope = `${dateStamp}/${this.config.region}/ses/aws4_request`;
      const stringToSign = [
        'AWS4-HMAC-SHA256',
        amzDate,
        credentialScope,
        crypto.createHash('sha256').update(canonicalRequest, 'utf8').digest('hex'),
      ].join('\n');

      const kDate = crypto.createHmac('sha256', `AWS4${this.config.secretAccessKey}`).update(dateStamp).digest();
      const kRegion = crypto.createHmac('sha256', kDate).update(this.config.region).digest();
      const kService = crypto.createHmac('sha256', kRegion).update('ses').digest();
      const kSigning = crypto.createHmac('sha256', kService).update('aws4_request').digest();
      const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');

      const authHeader = `AWS4-HMAC-SHA256 Credential=${this.config.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          ...headers,
          Authorization: authHeader,
        },
        body,
      });

      const responseBody = (await res.json().catch(() => ({}))) as any;

      if (!res.ok) {
        const errorDetail =
          responseBody?.message || responseBody?.Message || `HTTP ${res.status}: ${res.statusText}`;
        this.logger.error({
          event: 'aws_ses_delivery_failed',
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

      const messageId = responseBody?.MessageId || `ses-${Date.now()}`;
      this.logger.log({
        event: 'aws_ses_delivery_success',
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
        event: 'aws_ses_delivery_network_error',
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
