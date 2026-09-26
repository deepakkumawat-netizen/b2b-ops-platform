import { Body, Controller, Delete, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { StaffRole } from '@b2b-ops/shared';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { StaffService } from './staff.service';
import { UpdateStaffDto } from './dto/update-staff.dto';

@Controller('staff')
@UseGuards(StaffAuthGuard, RolesGuard)
export class StaffController {
  constructor(private staff: StaffService) {}

  @Get()
  @Roles(StaffRole.SUPER_ADMIN)
  list() {
    return this.staff.list();
  }

  @Patch(':id')
  @Roles(StaffRole.SUPER_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto, @CurrentStaff() actor: StaffJwtPayload) {
    return this.staff.update(id, dto, actor);
  }

  @Delete(':id')
  @Roles(StaffRole.SUPER_ADMIN)
  rejectPending(@Param('id') id: string) {
    return this.staff.rejectPending(id);
  }
}
