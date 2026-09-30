import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { GoogleCalendarService } from './google-calendar.service';

@Controller('google-calendar')
@UseGuards(StaffAuthGuard)
export class GoogleCalendarController {
  constructor(private google: GoogleCalendarService) {}

  /** Whether the shared Google Calendar is connected, and a link to open it. */
  @Get('status')
  status(@CurrentStaff() staff: StaffJwtPayload) {
    return this.google.status(staff);
  }

  /** Pushes every upcoming workshop and holiday to Google Calendar now. */
  @Post('sync')
  async syncNow(@CurrentStaff() staff: StaffJwtPayload) {
    const synced = await this.google.syncAll();
    return { synced, ...(await this.google.status(staff)) };
  }
}
