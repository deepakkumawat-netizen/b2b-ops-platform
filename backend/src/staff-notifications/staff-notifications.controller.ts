import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { StaffNotificationsService } from './staff-notifications.service';

@Controller('staff-notifications')
@UseGuards(StaffAuthGuard)
export class StaffNotificationsController {
  constructor(private notifications: StaffNotificationsService) {}

  @Get()
  list(@CurrentStaff() staff: StaffJwtPayload) {
    return this.notifications.list(staff);
  }

  @Post('seen')
  markAllSeen(@CurrentStaff() staff: StaffJwtPayload) {
    return this.notifications.markAllSeen(staff);
  }
}
