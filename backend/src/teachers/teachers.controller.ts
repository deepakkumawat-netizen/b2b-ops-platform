import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccessById } from '../common/scope';
import { TeachersService } from './teachers.service';
import { CreateTeacherDto } from './dto/create-teacher.dto';
import { UpdateTeacherDto } from './dto/update-teacher.dto';
import { SyncChecklistInterceptor } from '../automation/sync-checklist.interceptor';
import { SchoolAutomationService } from '../automation/school-automation.service';

@Controller('schools/:schoolId/teachers')
@UseGuards(StaffAuthGuard)
@UseInterceptors(SyncChecklistInterceptor)
export class TeachersController {
  constructor(
    private teachers: TeachersService,
    private prisma: PrismaService,
    private automation: SchoolAutomationService,
  ) {}

  @Get()
  async list(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.teachers.listForSchool(schoolId);
  }

  /** The school details page link, for staff to open or share (e.g. on WhatsApp). */
  @Get('form-link')
  async formLink(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return { url: this.automation.schoolDetailsLink(schoolId) };
  }

  /** (Re)sends the school the teacher-details form link. */
  @Post('request-details')
  async requestDetails(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return { sent: await this.automation.sendTeacherDetailsRequest(schoolId) };
  }

  @Post()
  async create(@Param('schoolId') schoolId: string, @Body() dto: CreateTeacherDto, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.teachers.create(schoolId, dto);
  }

  @Patch(':teacherId')
  async update(
    @Param('schoolId') schoolId: string,
    @Param('teacherId') teacherId: string,
    @Body() dto: UpdateTeacherDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.teachers.update(schoolId, teacherId, dto);
  }

  @Delete(':teacherId')
  async remove(
    @Param('schoolId') schoolId: string,
    @Param('teacherId') teacherId: string,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    await this.teachers.remove(schoolId, teacherId);
    return { success: true };
  }
}
