import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CalendarService } from './calendar.service';
import { CalendarController } from './calendar.controller';
import { SchoolCalendarController } from './school-calendar.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [CalendarController, SchoolCalendarController],
  providers: [CalendarService],
})
export class CalendarModule {}
