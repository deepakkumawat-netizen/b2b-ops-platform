import { Controller, Get, UseGuards } from '@nestjs/common';
import { StaffAuthGuard } from '../common/guards/staff-auth.guard';
import { CurrentStaff } from '../common/decorators/current-staff.decorator';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { PrismaService } from '../prisma/prisma.service';
import { schoolScopeWhere } from '../common/scope';

// Cross-school data for CSV exports. The per-school endpoints only return one
// school at a time; management reports need every school the viewer can see.
@Controller('reports')
@UseGuards(StaffAuthGuard)
export class ReportsController {
  constructor(private prisma: PrismaService) {}

  @Get('renewals')
  renewals(@CurrentStaff() staff: StaffJwtPayload) {
    return this.prisma.renewalCycle.findMany({
      where: { school: schoolScopeWhere(staff) },
      include: {
        school: {
          select: { id: true, name: true, city: true, state: true, assignedAccountManager: { select: { name: true } } },
        },
      },
      orderBy: [{ cycleLabel: 'desc' }, { createdAt: 'asc' }],
    });
  }
}
