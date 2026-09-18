import { Module } from '@nestjs/common';
import { EngagementModule } from '../engagement/engagement.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [EngagementModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
