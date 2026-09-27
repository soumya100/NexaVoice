import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SecurityModule } from '../security/security.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { ContactsModule } from '../contacts/contacts.module';
import { ConversationsService } from './conversations.service';
import { ConversationsResolver } from './conversations.resolver';

@Module({
  imports: [DatabaseModule, SecurityModule, AuthorizationModule, ContactsModule],
  providers: [ConversationsService, ConversationsResolver],
  exports: [ConversationsService],
})
export class ConversationsModule {}
