import { Body, Controller, Delete, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { CalendarService } from './calendar.service';
import { isValidSchoolCalendarToken } from './school-calendar-token';
import { AddHolidayDto } from './dto/holiday.dto';
import { RequestWorkshopDto } from './dto/workshop-request.dto';

// PUBLIC (no StaffAuthGuard): the school's calendar page from its emails.
// The signed token in the URL is the only credential, so a bad one gets a
// plain 404. The school sees only its own workshops and holidays, and can
// only add or remove its own holidays and request workshops for itself.
@Controller('public/school-calendar/:schoolId/:token')
export class SchoolCalendarController {
  constructor(
    private calendar: CalendarService,
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  @Get()
  async info(@Param('schoolId') schoolId: string, @Param('token') token: string) {
    this.check(schoolId, token);
    return this.calendar.forSchool(schoolId);
  }

  @Post('holidays')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async add(@Param('schoolId') schoolId: string, @Param('token') token: string, @Body() dto: AddHolidayDto) {
    this.check(schoolId, token);
    await this.prisma.school.findUniqueOrThrow({ where: { id: schoolId }, select: { id: true } }).catch(() => {
      throw new NotFoundException();
    });
    return this.calendar.addHoliday(schoolId, dto.date, dto.note?.trim() || null);
  }

  @Post('workshops')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async requestWorkshop(@Param('schoolId') schoolId: string, @Param('token') token: string, @Body() dto: RequestWorkshopDto) {
    this.check(schoolId, token);
    return this.calendar.requestWorkshop(schoolId, dto);
  }

  @Delete('holidays/:date')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async remove(@Param('schoolId') schoolId: string, @Param('token') token: string, @Param('date') date: string) {
    this.check(schoolId, token);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new NotFoundException();
    return this.calendar.removeHoliday(schoolId, date);
  }

  private check(schoolId: string, token: string) {
    if (!isValidSchoolCalendarToken(schoolId, token, this.config.getOrThrow<string>('JWT_ACCESS_SECRET'))) throw new NotFoundException();
  }
}
