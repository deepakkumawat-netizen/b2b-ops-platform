import { BadRequestException, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccessById } from '../common/scope';
import { ActivityService } from '../activity/activity.service';
import { CalendarService } from './calendar.service';

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

@Controller()
@UseGuards(StaffAuthGuard)
export class CalendarController {
  constructor(
    private calendar: CalendarService,
    private prisma: PrismaService,
    private activity: ActivityService,
  ) {}

  /** ?from=2026-10-01&to=2026-10-31 (inclusive days). */
  @Get('calendar')
  list(@CurrentStaff() staff: StaffJwtPayload, @Query('from') from: string, @Query('to') to: string) {
    if (!ISO_DAY.test(from ?? '') || !ISO_DAY.test(to ?? '')) throw new BadRequestException('from and to must look like 2026-10-01');
    return this.calendar.forStaff(staff, from, to);
  }

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
