import { Global, Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { EmailTemplateService } from './templates/email-template.service';
import { DevelopmentEmailProvider } from './providers/development-email.provider';
import { ResendEmailProvider } from './providers/resend-email.provider';
import { SendGridEmailProvider } from './providers/sendgrid-email.provider';
import { AwsSesEmailProvider } from './providers/aws-ses-email.provider';
import { SecurityModule } from '../security/security.module';

@Global()
@Module({
  imports: [SecurityModule],
  providers: [
    EmailService,
    EmailTemplateService,
    DevelopmentEmailProvider,
    ResendEmailProvider,
    SendGridEmailProvider,
    AwsSesEmailProvider,
  ],
  exports: [EmailService, EmailTemplateService, DevelopmentEmailProvider],
})
export class EmailModule {}
