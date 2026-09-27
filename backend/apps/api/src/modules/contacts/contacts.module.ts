import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { SecurityModule } from '../security/security.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { AuthenticationModule } from '../authentication/authentication.module';
import { ContactsService } from './contacts.service';
import { ContactsResolver } from './contacts.resolver';

@Module({
  imports: [DatabaseModule, SecurityModule, AuthorizationModule, AuthenticationModule],
  providers: [ContactsService, ContactsResolver],
  exports: [ContactsService],
})
export class ContactsModule {}
