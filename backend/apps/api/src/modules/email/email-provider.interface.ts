export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface SendEmailOptions {
  to: string | string[] | EmailRecipient | EmailRecipient[];
  from?: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  tags?: Record<string, string>;
}

export interface EmailDeliveryResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
  timestamp: Date;
}

export interface EmailProvider {
  readonly providerName: string;
  send(options: SendEmailOptions): Promise<EmailDeliveryResult>;
}
