import { Body, Controller, Get, Param, Patch, UseGuards, UseInterceptors } from '@nestjs/common';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { assertSchoolAccessById } from '../common/scope';
import { PhaseTasksService } from './phase-tasks.service';
import { UpdatePhaseTaskDto } from './dto/update-phase-task.dto';
import { SyncChecklistInterceptor } from '../automation/sync-checklist.interceptor';

@Controller('schools/:schoolId/phase-tasks')
@UseGuards(StaffAuthGuard)
@UseInterceptors(SyncChecklistInterceptor)
export class PhaseTasksController {
  constructor(
    private phaseTasks: PhaseTasksService,
    private prisma: PrismaService,
  ) {}

  @Get()
  async list(@Param('schoolId') schoolId: string, @CurrentStaff() staff: StaffJwtPayload) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.phaseTasks.listForSchool(schoolId);
  }

  @Patch(':taskId')
  async updateStatus(
    @Param('schoolId') schoolId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdatePhaseTaskDto,
    @CurrentStaff() staff: StaffJwtPayload,
  ) {
    await assertSchoolAccessById(this.prisma, staff, schoolId);
    return this.phaseTasks.updateStatus(schoolId, taskId, dto, staff);
  }
}
