import { Global, Module } from '@nestjs/common';
import { StaffNotificationsService } from './staff-notifications.service';
import { StaffNotificationsController } from './staff-notifications.controller';

// Global (like ActivityModule) so any agent or public form can raise a notification.
@Global()
@Module({
  controllers: [StaffNotificationsController],
  providers: [StaffNotificationsService],
  exports: [StaffNotificationsService],
})
export class StaffNotificationsModule {}
