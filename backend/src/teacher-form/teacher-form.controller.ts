import { Body, Controller, Get, NotFoundException, Param, Post } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { SchoolAutomationService } from '../automation/school-automation.service';
import { isValidTeacherFormToken } from './teacher-form-token';
import { SubmitTeacherFormDto } from './dto/submit-teacher-form.dto';

// PUBLIC (no StaffAuthGuard): the school opens the link from the
// teacher-details email. The signed token in the URL is the only
// credential, so a bad one gets a plain 404 — never a hint whether the
// school id exists. Exposes the school's name only.
@Controller('public/teacher-form/:schoolId/:token')
export class TeacherFormController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private activity: ActivityService,
    private automation: SchoolAutomationService,
  ) {}

  @Get()
  async info(@Param('schoolId') schoolId: string, @Param('token') token: string) {
    const school = await this.findSchool(schoolId, token);
    return { schoolName: school.name, teachersOnFile: await this.prisma.teacher.count({ where: { schoolId } }) };
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async submit(@Param('schoolId') schoolId: string, @Param('token') token: string, @Body() dto: SubmitTeacherFormDto) {
    await this.findSchool(schoolId, token);
    const rows = dto.teachers
      .map((t) => ({
        schoolId,
        name: t.name.trim(),
        phone: t.phone?.trim() || null,
        designation: t.designation?.trim() || null,
        gradeAssigned: t.gradeAssigned?.trim() || null,
      }))
      .filter((t) => t.name);
    const { count } = await this.prisma.teacher.createMany({ data: rows });
    await this.activity.record(schoolId, null, `School submitted ${count} teacher(s) via the details form`, rows.map((r) => r.name).join(', '));
    await this.automation.sync(schoolId); // ticks "Teacher details collected"
    return { added: count };
  }

  private async findSchool(schoolId: string, token: string) {
    const secret = this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    const school = isValidTeacherFormToken(schoolId, token, secret)
      ? await this.prisma.school.findUnique({ where: { id: schoolId }, select: { name: true } })
      : null;
    if (!school) throw new NotFoundException('This form link is not valid');
    return school;
  }
}
