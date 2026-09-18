import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { StaffRole } from '@b2b-ops/shared';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { SchoolsService } from './schools.service';
import { CreateSchoolDto } from './dto/create-school.dto';
import { UpdateSchoolDto } from './dto/update-school.dto';

@Controller('schools')
@UseGuards(StaffAuthGuard, RolesGuard)
export class SchoolsController {
  constructor(private schools: SchoolsService) {}

  @Post()
  @Roles(StaffRole.SALES) // SOP Phase 1: Sales owns the handover that creates a school
  create(@Body() dto: CreateSchoolDto) {
    return this.schools.create(dto);
  }

  @Get()
  findAll(@CurrentStaff() staff: StaffJwtPayload) {
    return this.schools.findAll(staff);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentStaff() staff: StaffJwtPayload) {
    return this.schools.findOne(id, staff);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSchoolDto, @CurrentStaff() staff: StaffJwtPayload) {
    return this.schools.update(id, dto, staff);
  }

  @Post(':id/advance-phase')
  advancePhase(@Param('id') id: string, @CurrentStaff() staff: StaffJwtPayload) {
    return this.schools.advancePhase(id, staff);
  }
}
