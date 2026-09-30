import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SignalingGateway } from './signaling.gateway';
import { AuthorizationModule } from '../authorization/authorization.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { PresenceModule } from '../presence/presence.module';

@Module({
  imports: [
    JwtModule,
    AuthorizationModule,
    DatabaseModule,
    forwardRef(() => PresenceModule),
  ],
  providers: [SignalingGateway],
  exports: [SignalingGateway],
})
export class RealtimeModule {}

