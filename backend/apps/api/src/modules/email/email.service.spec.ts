import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';
import { EmailTemplateService } from './templates/email-template.service';
import { DevelopmentEmailProvider } from './providers/development-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { SendGridEmailProvider } from './providers/sendgrid-email.provider';
import { AwsSesEmailProvider } from './providers/aws-ses-email.provider';
import { SecurityAuditService } from '../security/security-audit.service';

describe('Email Delivery Integration & Architecture', () => {
  let emailService: EmailService;
  let devProvider: DevelopmentEmailProvider;
  let resendProvider: ResendEmailProvider;
  let sendgridProvider: SendGridEmailProvider;
  let awsSesProvider: AwsSesEmailProvider;
  let templateService: EmailTemplateService;
  let mockSecurityAudit: any;
  let mockConfigService: any;

  beforeEach(async () => {
    mockSecurityAudit = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    };

    mockConfigService = {
      get: jest.fn((key: string, defaultVal?: any) => {
        if (key === 'email.from') return 'NexaVoice Security <security@nexavoice.io>';
        if (key === 'email.frontendUrl') return 'http://localhost:3000';
        if (key === 'email.provider') return 'development';
        return defaultVal;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmailService,
        EmailTemplateService,
        DevelopmentEmailProvider,
        ResendEmailProvider,
        SendGridEmailProvider,
        AwsSesEmailProvider,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: SecurityAuditService, useValue: mockSecurityAudit },
      ],
    }).compile();

    emailService = module.get<EmailService>(EmailService);
    devProvider = module.get<DevelopmentEmailProvider>(DevelopmentEmailProvider);
    resendProvider = module.get<ResendEmailProvider>(ResendEmailProvider);
    sendgridProvider = module.get<SendGridEmailProvider>(SendGridEmailProvider);
    awsSesProvider = module.get<AwsSesEmailProvider>(AwsSesEmailProvider);
    templateService = module.get<EmailTemplateService>(EmailTemplateService);
  });

  // ==========================================
  // 1. PROVIDER SELECTION & LIFECYCLE
  // ==========================================
  describe('Provider Selection', () => {
    it('defaults to DevelopmentEmailProvider in development/test environment', () => {
      const activeProvider = emailService.getActiveProvider();
      expect(activeProvider.providerName).toBe('development');
      expect(activeProvider).toBe(devProvider);
    });

    it('selects ResendEmailProvider when configured and api key is present', () => {
      jest.spyOn(resendProvider, 'isConfigured').mockReturnValue(true);
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'email.provider') return 'resend';
        return undefined;
      });

      const activeProvider = emailService.getActiveProvider();
      expect(activeProvider.providerName).toBe('resend');
    });

    it('selects SendGridEmailProvider when configured and api key is present', () => {
      jest.spyOn(sendgridProvider, 'isConfigured').mockReturnValue(true);
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'email.provider') return 'sendgrid';
        return undefined;
      });

      const activeProvider = emailService.getActiveProvider();
      expect(activeProvider.providerName).toBe('sendgrid');
    });

    it('selects AwsSesEmailProvider when configured and credentials are present', () => {
      jest.spyOn(awsSesProvider, 'isConfigured').mockReturnValue(true);
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'email.provider') return 'aws-ses';
        return undefined;
      });

      const activeProvider = emailService.getActiveProvider();
      expect(activeProvider.providerName).toBe('aws-ses');
    });
  });

  // ==========================================
  // 2. EMAIL TEMPLATES
  // ==========================================
  describe('EmailTemplateService', () => {
    it('renders password reset email with branding, CTA button, and single-use expiry notices', () => {
      const rendered = templateService.renderPasswordResetEmail({
        recipientName: 'Alice',
        resetUrl: 'http://localhost:3000/auth/reset-password?token=test-token-123',
        expiryMinutes: 60,
        ipAddress: '192.168.1.50',
      });

      expect(rendered.subject).toBe('Reset your NexaVoice password');
      expect(rendered.html).toContain('Alice');
      expect(rendered.html).toContain('http://localhost:3000/auth/reset-password?token=test-token-123');
      expect(rendered.html).toContain('Reset Password');
      expect(rendered.html).toContain('60 minutes');
      expect(rendered.html).toContain('192.168.1.50');
      expect(rendered.text).toContain('http://localhost:3000/auth/reset-password?token=test-token-123');
    });
  });

  // ==========================================
  // 3. SEND PASSWORD RESET EMAIL
  // ==========================================
  describe('EmailService.sendPasswordResetEmail', () => {
    it('dispatches password reset email through development provider and logs audit event', async () => {
      devProvider.clearSentEmails();

      const result = await emailService.sendPasswordResetEmail({
        to: 'alice@company.com',
        displayName: 'Alice Cooper',
        resetToken: 'secret-reset-token-999',
        ipAddress: '10.0.0.1',
      });

      expect(result.success).toBe(true);
      expect(result.provider).toBe('development');
      expect(result.messageId).toBeDefined();

      const lastSent = devProvider.getLastSentEmail();
      expect(lastSent).toBeDefined();
      expect(lastSent?.to).toBe('alice@company.com');
      expect(lastSent?.subject).toBe('Reset your NexaVoice password');
      expect(lastSent?.html).toContain('secret-reset-token-999');

      expect(mockSecurityAudit.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'PASSWORD_RESET_EMAIL_DISPATCHED',
          result: 'SUCCESS',
          ipAddress: '10.0.0.1',
        }),
      );
    });
  });

  // ==========================================
  // 4. RESEND PROVIDER INTEGRATION
  // ==========================================
  describe('ResendEmailProvider', () => {
    it('returns error if API key is unconfigured', async () => {
      jest.spyOn(resendProvider, 'isConfigured').mockReturnValue(false);

      const result = await resendProvider.send({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('dispatches to Resend API when configured', async () => {
      jest.spyOn(resendProvider, 'isConfigured').mockReturnValue(true);

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 're_123456789' }),
      });
      global.fetch = mockFetch;

      const result = await resendProvider.send({
        to: 'user@example.com',
        subject: 'Reset Password',
        html: '<p>Click here</p>',
        text: 'Click here',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('re_123456789');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.resend.com/emails',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  // ==========================================
  // 5. SENDGRID PROVIDER INTEGRATION
  // ==========================================
  describe('SendGridEmailProvider', () => {
    it('returns error if API key is unconfigured', async () => {
      jest.spyOn(sendgridProvider, 'isConfigured').mockReturnValue(false);

      const result = await sendgridProvider.send({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('dispatches to SendGrid API v3 when configured', async () => {
      jest.spyOn(sendgridProvider, 'isConfigured').mockReturnValue(true);

      const mockHeaders = new Map();
      mockHeaders.set('x-message-id', 'sg-message-123');

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        headers: { get: (name: string) => mockHeaders.get(name.toLowerCase()) },
        json: async () => ({}),
      });
      global.fetch = mockFetch;

      const result = await sendgridProvider.send({
        to: 'user@example.com',
        subject: 'Reset Password',
        html: '<p>Click here</p>',
        text: 'Click here',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('sg-message-123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.sendgrid.com/v3/mail/send',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });

  // ==========================================
  // 6. AWS SES PROVIDER INTEGRATION
  // ==========================================
  describe('AwsSesEmailProvider', () => {
    it('returns error if credentials are unconfigured', async () => {
      jest.spyOn(awsSesProvider, 'isConfigured').mockReturnValue(false);

      const result = await awsSesProvider.send({
        to: 'user@example.com',
        subject: 'Test',
        html: '<p>Test</p>',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('dispatches to AWS SES v2 API with SigV4 authentication headers when configured', async () => {
      jest.spyOn(awsSesProvider, 'isConfigured').mockReturnValue(true);

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ MessageId: 'ses-msg-abcdef123456' }),
      });
      global.fetch = mockFetch;

      const result = await awsSesProvider.send({
        to: 'user@example.com',
        subject: 'Reset Password',
        html: '<p>Click here</p>',
        text: 'Click here',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('ses-msg-abcdef123456');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v2/email/outbound-emails'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expect.stringContaining('AWS4-HMAC-SHA256'),
          }),
        }),
      );
    });
  });
});
