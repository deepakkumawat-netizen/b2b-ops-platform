import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccessById } from '../common/scope';
import { RenewalsService } from './renewals.service';
import { CreateRenewalCycleDto } from './dto/create-renewal-cycle.dto';
import { UpdateRenewalCycleDto } from './dto/update-renewal-cycle.dto';

@Controller('schools/:schoolId/renewals')
@UseGuards(StaffAuthGuard)
export class RenewalsController {
  constructor(
    private renewals: RenewalsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async list(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.renewals.listForSchool(schoolId);
  }

  @Get('year-summary')
  async yearSummary(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.renewals.getYearSummary(schoolId);
  }

  @Post()
  async create(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateRenewalCycleDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.renewals.create(schoolId, dto);
  }

  @Patch(':cycleId')
  async update(
    @Param('schoolId') schoolId: string,
    @Param('cycleId') cycleId: string,
    @Body() dto: UpdateRenewalCycleDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.renewals.update(schoolId, cycleId, dto);
  }
}
