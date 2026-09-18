import { Injectable } from '@nestjs/common';
import { RenewalStatus, WorkshopStatus } from '@b2b-ops/shared';
import { PrismaService } from '../prisma/prisma.service';
import { EngagementService } from '../engagement/engagement.service';
import { StaffJwtPayload } from '../auth/jwt-payload.interface';
import { schoolScopeWhere } from '../common/scope';

const UPCOMING_WORKSHOP_WINDOW_DAYS = 7;

@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private engagement: EngagementService,
  ) {}

  async getDashboard(staff: StaffJwtPayload) {
    const where = schoolScopeWhere(staff);
    const schools = await this.prisma.school.findMany({ where, select: { id: true, name: true, currentPhase: true } });
    const schoolIds = schools.map((s) => s.id);

    const schoolsByPhase: Record<string, number> = {};
    for (const school of schools) {
      schoolsByPhase[school.currentPhase] = (schoolsByPhase[school.currentPhase] ?? 0) + 1;
    }

    const overdue = await this.engagement.getOverdueStatusForSchools(schoolIds);
    const overdueVisits = schools
      .filter((s) => overdue.get(s.id)?.visitOverdue)
      .map((s) => ({ schoolId: s.id, name: s.name, lastVisitDate: overdue.get(s.id)?.lastVisitDate ?? null }));
    const overdueCalls = schools
      .filter((s) => overdue.get(s.id)?.callOverdue)
      .map((s) => ({ schoolId: s.id, name: s.name, lastCallDate: overdue.get(s.id)?.lastCallDate ?? null }));

    const now = new Date();
    const windowEnd = new Date(now.getTime() + UPCOMING_WORKSHOP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const upcomingWorkshops = await this.prisma.workshop.findMany({
      where: {
        schoolId: { in: schoolIds },
        scheduledAt: { gte: now, lte: windowEnd },
        status: { in: [WorkshopStatus.SCHEDULED, WorkshopStatus.CONFIRMED] },
      },
      include: { school: { select: { name: true } } },
      orderBy: { scheduledAt: 'asc' },
    });

    const pendingRenewals = await this.prisma.renewalCycle.findMany({
      where: { schoolId: { in: schoolIds }, renewalStatus: { in: [RenewalStatus.PENDING, RenewalStatus.APPROACHED] } },
      include: { school: { select: { name: true } } },
      orderBy: { createdAt: 'asc' },
    });

    return {
      totalSchools: schools.length,
      schoolsByPhase,
      overdueVisits,
      overdueCalls,
      upcomingWorkshops,
      pendingRenewals,
    };
  }
}
