import { Global, Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { SchoolAutomationService } from './school-automation.service';

// Global (like ActivityModule) because every feature module whose changes
// can complete a checklist task calls SchoolAutomationService.sync().
@Global()
@Module({
  imports: [NotificationsModule],
  providers: [SchoolAutomationService],
  exports: [SchoolAutomationService],
})
export class AutomationModule {}
