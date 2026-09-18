import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccessById } from '../common/scope';
import { CompetitionsService } from './competitions.service';
import { CreateCompetitionDto } from './dto/create-competition.dto';

@Controller('schools/:schoolId/competitions')
@UseGuards(StaffAuthGuard)
export class CompetitionsController {
  constructor(
    private competitions: CompetitionsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async list(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.competitions.listForSchool(schoolId);
  }

  @Post()
  async create(
    @Param('schoolId') schoolId: string,
    @Body() dto: CreateCompetitionDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.competitions.create(schoolId, dto);
  }
}
