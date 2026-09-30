import { Module, forwardRef } from '@nestjs/common';
import { CacheModule } from '../../infrastructure/cache/cache.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { AuthorizationModule } from '../authorization/authorization.module';
import { PresenceService } from './presence.service';
import { PresenceResolver } from './presence.resolver';

@Module({
  imports: [
    CacheModule,
    forwardRef(() => RealtimeModule),
    AuthorizationModule,
  ],
  providers: [PresenceService, PresenceResolver],
  exports: [PresenceService],
})
export class PresenceModule {}
