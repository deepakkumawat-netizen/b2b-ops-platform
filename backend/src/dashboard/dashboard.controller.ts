import { Controller, Get, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
@UseGuards(StaffAuthGuard)
export class DashboardController {
  constructor(private dashboard: DashboardService) {}

  @Get()
  get(@CurrentStaff() staff: StaffJwtPayload) {
    return this.dashboard.getDashboard(staff);
  }
}
