import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccessById } from '../common/scope';
import { EngagementService } from './engagement.service';
import { CreateEngagementLogDto } from './dto/create-engagement-log.dto';

@Controller('schools/:schoolId/engagement-logs')
@UseGuards(StaffAuthGuard)
export class EngagementController {
  constructor(
    private engagement: EngagementService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async list(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.engagement.listForSchool(schoolId);
  }

  @Post()
  async create(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateEngagementLogDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.engagement.create(schoolId, dto, staff.sub);
  }
}
