import { Body, Controller, Get, Param, Put, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccessById } from '../common/scope';
import { InfraDiagnosticsService } from './infra-diagnostics.service';
import { UpsertInfraDiagnosticDto } from './dto/upsert-infra-diagnostic.dto';

@Controller('schools/:schoolId/infra-diagnostic')
@UseGuards(StaffAuthGuard)
export class InfraDiagnosticsController {
  constructor(
    private infraDiagnostics: InfraDiagnosticsService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async get(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.infraDiagnostics.get(schoolId);
  }

  @Put()
  async upsert(
    @Param('schoolId') schoolId: string,
    @Body() dto: UpsertInfraDiagnosticDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.infraDiagnostics.upsert(schoolId, dto);
  }
}
