import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccessById } from '../common/scope';
import { ActivityService } from '../activity/activity.service';
import { CalendarService } from './calendar.service';

@Controller()
@UseGuards(StaffAuthGuard)
export class CalendarController {
  constructor(
    private calendar: CalendarService,
    private prisma: PrismaService,
    private activity: ActivityService,
  ) {}

  @Get('schools/:schoolId/calendar-link')
  async link(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return { url: this.calendar.calendarLink(schoolId) };
  }

  @Post('schools/:schoolId/calendar-link/send')
  async send(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    const result = await this.calendar.sendLinkToSchool(schoolId);
    if (result.sent) await this.activity.record(schoolId, staff, 'Emailed the school its workshop calendar link');
    return result;
  }
}
