import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SecurityModule } from '../security/security.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ContactsModule } from '../contacts/contacts.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuthenticationModule } from '../authentication/authentication.module';
import { MessagingService } from './messaging.service';
import { MessagingResolver } from './messaging.resolver';
import { AttachmentsService } from './attachments.service';
import { LinkPreviewService } from './link-preview.service';
import { SearchService } from './search.service';
import { OutboxWorker } from './outbox.worker';

@Module({
  imports: [
    DatabaseModule,
    SecurityModule,
    AuthorizationModule,
    ContactsModule,
    RealtimeModule,
    AuthenticationModule,
  ],
  providers: [
    MessagingService,
    MessagingResolver,
    AttachmentsService,
    LinkPreviewService,
    SearchService,
    OutboxWorker,
  ],
  exports: [MessagingService, AttachmentsService, SearchService, OutboxWorker],
})
export class MessagingModule {}
