import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Put } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { SchoolAutomationService } from '../automation/school-automation.service';
import { isValidTeacherFormToken } from './teacher-form-token';
import {
  PublicInfraDto,
  PublicLogoUploadDto,
  PublicOrientationDto,
  SubmitStudentsDto,
  SubmitTeacherFormDto,
} from './dto/submit-teacher-form.dto';
import { OnboardingService } from '../onboarding/onboarding.service';
import { SCHOOL_DETAILS_PARTS, SCHOOL_DETAILS_SELECT, schoolDetailsCounts } from './school-details';
import { formatDateInZone, startOfDayInZone } from '../common/time';

// PUBLIC (no StaffAuthGuard): the school's details page — the link it gets
// by email (teachers, students, logo, lab & internet, orientation date).
// The signed token in the URL is the only credential, so a bad one gets a
// plain 404 — never a hint whether the school id exists. Exposes only what
// the school itself filled in, plus counts — never other school data.
// (Route stays /teacher-form so links in emails already sent keep working.)
@Controller('public/teacher-form/:schoolId/:token')
export class TeacherFormController {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private activity: ActivityService,
    private automation: SchoolAutomationService,
    private onboarding: OnboardingService,
  ) {}

  @Get()
  async info(@Param('schoolId') schoolId: string, @Param('token') token: string) {
    await this.findSchool(schoolId, token);
    const school = await this.prisma.school.findUniqueOrThrow({
      where: { id: schoolId },
      select: {
        ...SCHOOL_DETAILS_SELECT,
        name: true,
        orientationNote: true,
        // Wider than SCHOOL_DETAILS_SELECT's (still has the id it needs) — the page shows what was filled in.
        infraDiagnostic: { select: { id: true, labCapacity: true, internetConnectivity: true, systemsPerStudent: true } },
      },
    });
    const counts = schoolDetailsCounts(school);
    return {
      schoolName: school.name,
      teachersOnFile: counts.teachers,
      studentsOnFile: counts.students,
      hasLogo: counts.hasLogo,
      infra: school.infraDiagnostic,
      orientation: school.orientationPreferredDate ? { date: school.orientationPreferredDate, note: school.orientationNote } : null,
      partsDone: SCHOOL_DETAILS_PARTS.filter((p) => p.done(counts)).length,
      partsTotal: SCHOOL_DETAILS_PARTS.length,
    };
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

  @Post('students')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async submitStudents(@Param('schoolId') schoolId: string, @Param('token') token: string, @Body() dto: SubmitStudentsDto) {
    await this.findSchool(schoolId, token);
    const rows = dto.students
      .map((s) => ({ schoolId, name: s.name.trim(), grade: s.grade?.trim() || null, section: s.section?.trim() || null }))
      .filter((s) => s.name);
    const { count } = await this.prisma.student.createMany({ data: rows });
    await this.activity.record(schoolId, null, `School submitted ${count} student(s) via the details form`);
    await this.automation.sync(schoolId); // ticks "Student details collected"
    return { added: count };
  }

  /** The school's logo, plus the co-branded version its browser made from it. */
  @Post('logo')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async uploadLogo(@Param('schoolId') schoolId: string, @Param('token') token: string, @Body() dto: PublicLogoUploadDto) {
    await this.findSchool(schoolId, token);
    await this.onboarding.saveAsset(schoolId, 'LOGO', dto.logo, null);
    if (dto.cobranded) await this.onboarding.saveAsset(schoolId, 'COBRANDED_LOGO', dto.cobranded, null);
    await this.automation.sync(schoolId); // ticks "School's logo collected" / "Co-branded logo designed"
    return { success: true };
  }

  /** Lab & internet — the school's half of the infra diagnostic (SOP Phase 6).
   * Never touches the session mix, which our team recommends from it. */
  @Put('infra')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async saveInfra(@Param('schoolId') schoolId: string, @Param('token') token: string, @Body() dto: PublicInfraDto) {
    await this.findSchool(schoolId, token);
    const data = {
      labCapacity: dto.labCapacity?.trim() || null,
      internetConnectivity: dto.internetConnectivity?.trim() || null,
      systemsPerStudent: dto.systemsPerStudent?.trim() || null,
    };
    await this.prisma.infraDiagnostic.upsert({ where: { schoolId }, create: { schoolId, ...data }, update: data });
    await this.activity.record(schoolId, null, 'School filled in its computer lab & internet details');
    await this.automation.sync(schoolId); // ticks "Infrastructure diagnostic form sent"
    return { success: true };
  }

  @Put('orientation')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async saveOrientation(@Param('schoolId') schoolId: string, @Param('token') token: string, @Body() dto: PublicOrientationDto) {
    await this.findSchool(schoolId, token);
    const date = new Date(dto.date);
    const now = new Date();
    if (Number.isNaN(date.getTime()) || date < startOfDayInZone(now, 1) || date > startOfDayInZone(now, 366)) {
      throw new BadRequestException('Please pick a date from tomorrow onwards, within the next year.');
    }
    const note = dto.note?.trim() || null;
    await this.prisma.school.update({ where: { id: schoolId }, data: { orientationPreferredDate: date, orientationNote: note } });
    await this.activity.record(schoolId, null, 'School picked its orientation date', `${formatDateInZone(date)}${note ? ` — ${note}` : ''}`);
    await this.automation.notifyOrientationDatePicked(schoolId);
    return { success: true };
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
