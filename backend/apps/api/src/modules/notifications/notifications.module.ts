import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { NotificationsResolver } from './notifications.resolver';
import { NotificationsService } from './notifications.service';

@Module({
  imports: [DatabaseModule],
  providers: [NotificationsService, NotificationsResolver],
  exports: [NotificationsService],
})
export class NotificationsModule {}
