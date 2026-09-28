import { Module, forwardRef } from '@nestjs/common';
import { SecurityModule } from '../security/security.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { CallingModule } from '../calling/calling.module';

import { PhoneNumberNormalizerService } from './services/phone-number-normalizer.service';
import { TollFraudProtectionService } from './services/toll-fraud-protection.service';
import { MockTelephonyProvider } from './providers/mock-telephony.provider';
import { TwilioTelephonyProvider } from './providers/twilio-telephony.provider';
import { TelnyxTelephonyProvider } from './providers/telnyx-telephony.provider';
import { PhoneNumberService } from './services/phone-number.service';
import { TelephonyRoutingService } from './services/telephony-routing.service';
import { VoicemailService } from './services/voicemail.service';
import { TelephonyService } from './services/telephony.service';
import { TelephonyWebhookController } from './controllers/telephony-webhook.controller';
import { TelephonyResolver } from './graphql/telephony.resolver';

@Module({
  imports: [
    SecurityModule,
    RealtimeModule,
    forwardRef(() => CallingModule),
  ],
  controllers: [TelephonyWebhookController],
  providers: [
    PhoneNumberNormalizerService,
    TollFraudProtectionService,
    MockTelephonyProvider,
    TwilioTelephonyProvider,
    TelnyxTelephonyProvider,
    PhoneNumberService,
    TelephonyRoutingService,
    VoicemailService,
    TelephonyService,
    TelephonyResolver,
  ],
  exports: [
    TelephonyService,
    PhoneNumberService,
    PhoneNumberNormalizerService,
    TelephonyRoutingService,
    VoicemailService,
    MockTelephonyProvider,
  ],
})
export class TelephonyModule {}
