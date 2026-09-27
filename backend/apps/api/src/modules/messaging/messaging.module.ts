import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SecurityModule } from '../security/security.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ContactsModule } from '../contacts/contacts.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { MessagingService } from './messaging.service';
import { MessagingResolver } from './messaging.resolver';
import { AttachmentsService } from './attachments.service';
import { LinkPreviewService } from './link-preview.service';
import { SearchService } from './search.service';

@Module({
  imports: [
    DatabaseModule,
    SecurityModule,
    AuthorizationModule,
    ContactsModule,
    RealtimeModule,
  ],
  providers: [
    MessagingService,
    MessagingResolver,
    AttachmentsService,
    LinkPreviewService,
    SearchService,
  ],
  exports: [MessagingService, AttachmentsService, SearchService],
})
export class MessagingModule {}
