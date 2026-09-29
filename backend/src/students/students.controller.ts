import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { IsBoolean } from 'class-validator';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccessById } from '../common/scope';
import { SyncChecklistInterceptor } from '../automation/sync-checklist.interceptor';
import { ActivityService } from '../activity/activity.service';

export class SetLmsCredentialDto {
  @IsBoolean()
  lmsCredentialGenerated!: boolean;
}

// Students the school filled in on its school details page (SOP Phase 5).
// Staff track LMS credentials here; ticking every student proves "Student
// LMS credentials generated".
@Controller('schools/:schoolId/students')
@UseGuards(StaffAuthGuard)
@UseInterceptors(SyncChecklistInterceptor)
export class StudentsController {
  constructor(
    private prisma: PrismaService,
    private activity: ActivityService,
  ) {}

  @Get()
  async list(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.prisma.student.findMany({ where: { schoolId }, orderBy: [{ grade: 'asc' }, { section: 'asc' }, { name: 'asc' }] });
  }

  @Patch(':studentId')
  async setLms(
    @Param('schoolId') schoolId: string,
    @Param('studentId') studentId: string,
    @Body() dto: SetLmsCredentialDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    const { count } = await this.prisma.student.updateMany({ where: { id: studentId, schoolId }, data: dto });
    if (count === 0) throw new NotFoundException('Student not found');
    return { success: true };
  }

  @Post('lms-credentials-generated')
  async markAll(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    const { count } = await this.prisma.student.updateMany({ where: { schoolId, lmsCredentialGenerated: false }, data: { lmsCredentialGenerated: true } });
    if (count > 0) await this.activity.record(schoolId, staff, `Marked LMS credentials generated for ${count} student(s)`);
    return { updated: count };
  }

  @Delete(':studentId')
  async remove(@Param('schoolId') schoolId: string, @Param('studentId') studentId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    const { count } = await this.prisma.student.deleteMany({ where: { id: studentId, schoolId } });
    if (count === 0) throw new NotFoundException('Student not found');
    return { success: true };
  }
}
