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

@Controller('schools/:schoolId/workshops')
@UseGuards(StaffAuthGuard)
export class WorkshopsController {
  constructor(
    private workshops: WorkshopsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async list(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.workshops.listForSchool(schoolId);
  }

  @Post()
  async create(@Param('schoolId') schoolId: string, @Body() dto: CreateWorkshopDto, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.workshops.create(schoolId, dto);
  }

  @Patch(':workshopId')
  async update(
    @Param('schoolId') schoolId: string,
    @Param('workshopId') workshopId: string,
    @Body() dto: UpdateWorkshopDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.workshops.update(schoolId, workshopId, dto);
  }

  @Post(':workshopId/confirm')
  async confirm(@Param('schoolId') schoolId: string, @Param('workshopId') workshopId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.workshops.confirm(schoolId, workshopId);
  }

  @Post(':workshopId/remind')
  async remind(@Param('schoolId') schoolId: string, @Param('workshopId') workshopId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.workshops.remind(schoolId, workshopId);
  }

  @Post(':workshopId/complete')
  async complete(@Param('schoolId') schoolId: string, @Param('workshopId') workshopId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.workshops.complete(schoolId, workshopId);
  }

  @Post(':workshopId/cancel')
  async cancel(
    @Param('schoolId') schoolId: string,
    @Param('workshopId') workshopId: string,
    @Body() dto: CancelWorkshopDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.workshops.cancel(schoolId, workshopId, dto);
  }

  @Patch(':workshopId/feedback')
  async recordFeedback(
    @Param('schoolId') schoolId: string,
    @Param('workshopId') workshopId: string,
    @Body() dto: RecordFeedbackDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.workshops.recordFeedback(schoolId, workshopId, dto);
  }
}
