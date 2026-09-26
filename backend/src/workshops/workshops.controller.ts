import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccessById } from '../common/scope';
import { WorkshopsService } from './workshops.service';
import { CreateWorkshopDto } from './dto/create-workshop.dto';
import { UpdateWorkshopDto } from './dto/update-workshop.dto';
import { CancelWorkshopDto } from './dto/cancel-workshop.dto';
import { RecordFeedbackDto } from './dto/record-feedback.dto';
import { ActivityService } from '../activity/activity.service';

@Controller('schools/:schoolId/workshops')
@UseGuards(StaffAuthGuard)
export class WorkshopsController {
  constructor(
    private workshops: WorkshopsService,
    private prisma: PrismaService,
    private activity: ActivityService,
  ) {}

  @Get()
  async list(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.workshops.listForSchool(schoolId);
  }

  @Post()
  async create(@Param('schoolId') schoolId: string, @Body() dto: CreateWorkshopDto, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    const w = await this.workshops.create(schoolId, dto);
    await this.activity.record(schoolId, staff, `Workshop scheduled: ${w.topic}`);
    return w;
  }

  @Patch(':workshopId')
  async update(
    @Param('schoolId') schoolId: string,
    @Param('workshopId') workshopId: string,
    @Body() dto: UpdateWorkshopDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    const w = await this.workshops.update(schoolId, workshopId, dto);
    await this.activity.record(schoolId, staff, `Workshop updated: ${w.topic}`);
    return w;
  }

  @Post(':workshopId/confirm')
  async confirm(@Param('schoolId') schoolId: string, @Param('workshopId') workshopId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    const w = await this.workshops.confirm(schoolId, workshopId);
    await this.activity.record(schoolId, staff, `Workshop confirmed: ${w.topic}`);
    return w;
  }

  @Post(':workshopId/remind')
  async remind(@Param('schoolId') schoolId: string, @Param('workshopId') workshopId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    const w = await this.workshops.remind(schoolId, workshopId);
    await this.activity.record(schoolId, staff, `Workshop reminder sent: ${w.topic}`);
    return w;
  }

  @Post(':workshopId/complete')
  async complete(@Param('schoolId') schoolId: string, @Param('workshopId') workshopId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    const w = await this.workshops.complete(schoolId, workshopId);
    await this.activity.record(schoolId, staff, `Workshop completed: ${w.topic}`);
    return w;
  }

  @Post(':workshopId/cancel')
  async cancel(
    @Param('schoolId') schoolId: string,
    @Param('workshopId') workshopId: string,
    @Body() dto: CancelWorkshopDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    const w = await this.workshops.cancel(schoolId, workshopId, dto);
    await this.activity.record(schoolId, staff, `Workshop cancelled: ${w.topic}`, dto.cancelReason);
    return w;
  }

  @Patch(':workshopId/feedback')
  async recordFeedback(
    @Param('schoolId') schoolId: string,
    @Param('workshopId') workshopId: string,
    @Body() dto: RecordFeedbackDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    const w = await this.workshops.recordFeedback(schoolId, workshopId, dto);
    await this.activity.record(schoolId, staff, `Workshop feedback recorded: ${w.topic}`);
    return w;
  }
}
