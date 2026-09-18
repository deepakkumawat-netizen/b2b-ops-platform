import { Module } from '@nestjs/common';
import { MailerService } from './mailer.service';
import { NotificationsService } from './notifications.service';

@Module({
  providers: [MailerService, NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
