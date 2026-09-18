import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { PhaseTasksService } from './phase-tasks.service';
import { PhaseTasksController } from './phase-tasks.controller';

@Module({
  imports: [NotificationsModule],
  controllers: [PhaseTasksController],
  providers: [PhaseTasksService],
  exports: [PhaseTasksService],
})
export class PhaseTasksModule {}
