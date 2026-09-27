import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { SignalingGateway } from './signaling.gateway';
import { AuthorizationModule } from '../authorization/authorization.module';

@Module({
  imports: [JwtModule, AuthorizationModule],
  providers: [SignalingGateway],
  exports: [SignalingGateway],
})
export class RealtimeModule {}
