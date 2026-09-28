import { Injectable } from '@nestjs/common';

export interface PasswordResetTemplateParams {
  recipientName?: string;
  resetUrl: string;
  expiryMinutes?: number;
  ipAddress?: string;
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailTemplateService {
  renderPasswordResetEmail(params: PasswordResetTemplateParams): RenderedEmail {
    const { recipientName = 'there', resetUrl, expiryMinutes = 60, ipAddress } = params;
    const subject = 'Reset your NexaVoice password';

    const text = `Hello ${recipientName},

We received a request to reset your password for your NexaVoice account.

To select a new password, open this link in your browser:
${resetUrl}

This link is single-use and will expire in ${expiryMinutes} minutes.${ipAddress ? `\nRequest was initiated from IP: ${ipAddress}` : ''}

If you did not request a password reset, please ignore this email. Your password will remain unchanged.

Best regards,
The NexaVoice Security Team
https://nexavoice.io`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #090d16;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #f8fafc;
      -webkit-font-smoothing: antialiased;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #090d16;
      padding: 40px 16px;
    }
    .container {
      max-width: 560px;
      margin: 0 auto;
      background-color: #0f172a;
      border: 1px solid #1e293b;
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    }
    .header {
      padding: 32px 32px 24px 32px;
      border-bottom: 1px solid #1e293b;
      background: linear-gradient(180deg, #172033 0%, #0f172a 100%);
    }
    .logo-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
    }
    .logo-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, #6366f1, #06b6d4);
      display: inline-block;
      vertical-align: middle;
      text-align: center;
      line-height: 32px;
      font-weight: 800;
      color: #ffffff;
      font-size: 16px;
    }
    .brand-name {
      font-size: 20px;
      font-weight: 800;
      color: #f8fafc;
      letter-spacing: -0.02em;
      vertical-align: middle;
      display: inline-block;
      margin-left: 8px;
    }
    .brand-accent {
      color: #06b6d4;
    }
    .content {
      padding: 32px;
    }
    h1 {
      font-size: 20px;
      font-weight: 700;
      margin: 0 0 16px 0;
      color: #ffffff;
      letter-spacing: -0.01em;
    }
    p {
      font-size: 14px;
      line-height: 1.6;
      color: #94a3b8;
      margin: 0 0 20px 0;
    }
    .btn-container {
      margin: 32px 0;
      text-align: center;
    }
    .button {
      display: inline-block;
      padding: 13px 28px;
      background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
      color: #ffffff !important;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      border-radius: 10px;
      box-shadow: 0 4px 14px rgba(99, 102, 241, 0.4);
      letter-spacing: -0.01em;
    }
    .security-notice {
      background-color: #172033;
      border-left: 3px solid #06b6d4;
      padding: 14px 16px;
      border-radius: 8px;
      margin: 24px 0;
    }
    .security-notice p {
      font-size: 12.5px;
      color: #cbd5e1;
      margin: 0;
    }
    .url-fallback {
      font-size: 12px;
      color: #64748b;
      word-break: break-all;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #1e293b;
    }
    .url-fallback a {
      color: #06b6d4;
      text-decoration: none;
    }
    .footer {
      padding: 24px 32px;
      background-color: #090d16;
      border-top: 1px solid #1e293b;
      text-align: center;
      font-size: 11px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <div class="logo-badge">
          <span class="logo-icon">N</span>
          <span class="brand-name">Nexa<span class="brand-accent">Voice</span></span>
        </div>
      </div>
      <div class="content">
        <h1>Reset your password</h1>
        <p>Hello ${recipientName},</p>
        <p>
          We received a request to reset the password for your NexaVoice account.
          Click the button below to choose a new password.
        </p>
        
        <div class="btn-container">
          <a href="${resetUrl}" class="button" target="_blank" rel="noopener noreferrer">Reset Password</a>
        </div>

        <div class="security-notice">
          <p>
            <strong>Security Notice:</strong> This link will expire in ${expiryMinutes} minutes and can only be used once.${ipAddress ? ` Request originated from IP: ${ipAddress}.` : ''}
          </p>
        </div>

        <p style="font-size: 13px; color: #64748b;">
          If you did not request this password reset, no action is needed. Your account remains secure and your password will not be changed.
        </p>

        <div class="url-fallback">
          Having trouble with the button? Copy and paste this URL into your browser:<br>
          <a href="${resetUrl}">${resetUrl}</a>
        </div>
      </div>
      <div class="footer">
        © 2026 NexaVoice Inc. • Zero-Trust Cryptographic Identity & Real-Time Communications<br>
        548 Market St, San Francisco, CA 94104
      </div>
    </div>
  </div>
</body>
</html>`;

    return { subject, html, text };
  }
}
