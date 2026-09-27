import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SignalingGateway } from './signaling.gateway';
import { AuthorizationModule } from '../authorization/authorization.module';
import { DatabaseModule } from '../../infrastructure/database/database.module';

@Module({
  imports: [JwtModule, AuthorizationModule, DatabaseModule],
  providers: [SignalingGateway],
  exports: [SignalingGateway],
})
export class RealtimeModule {}
