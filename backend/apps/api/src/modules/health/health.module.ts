import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthResolver } from './health.resolver';
import { HealthService } from './health.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  controllers: [HealthController],
  providers: [HealthService, HealthResolver],
  exports: [HealthService],
})
export class HealthModule {}
